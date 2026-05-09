/*
 * High-Performance Distributed Matrix Multiplication using MPI
 * 
 * Algorithm: Row-based scatter/gather approach with collective communications
 * 
 * Matrix Multiplication: C = A * B
 * - Matrix A: M x K distributed by rows across processes
 * - Matrix B: K x N broadcast to all processes
 * - Matrix C: M x N gathered from all processes
 * 
 * Communication Pattern:
 * 1. MPI_Scatter distributes rows of A (non-uniform block distribution)
 * 2. MPI_Bcast distributes full matrix B
 * 3. Local computation: C_local = A_local * B
 * 4. MPI_Gather collects results to process 0
 * 
 * Compilation:
 *   mpic++ -O3 -march=native -std=c++14 -o matmul_mpi matmul_mpi.cpp -lm
 * 
 * Execution:
 *   mpirun -np <num_processes> ./matmul_mpi <M> <K> <N>
 *   
 * Example:
 *   mpirun -np 4 ./matmul_mpi 4096 4096 4096
 */

#include <mpi.h>
#include <cstdlib>
#include <cstdio>
#include <cstring>
#include <cmath>
#include <chrono>
#include <algorithm>

/* Type definitions for cleaner code */
typedef double scalar_t;
typedef int idx_t;

/* Forward declarations */
void initialize_matrix(scalar_t* matrix, idx_t rows, idx_t cols, int seed);
void zero_matrix(scalar_t* matrix, idx_t rows, idx_t cols);
scalar_t frobenius_norm(const scalar_t* matrix, idx_t rows, idx_t cols);
void print_matrix(const scalar_t* matrix, idx_t rows, idx_t cols, const char* name);

/*
 * Distributed matrix multiplication using MPI with row-based distribution
 *
 * Parameters:
 *  - M: number of rows in A (and C)
 *  - K: number of columns in A (and rows in B)
 *  - N: number of columns in B (and C)
 */
int main(int argc, char** argv)
{
    /* MPI initialization */
    MPI_Init(&argc, &argv);
    
    int rank, size;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &size);
    
    /* Parse command line arguments */
    if (argc != 4) {
        if (rank == 0) {
            fprintf(stderr, "Usage: %s <M> <K> <N>\n", argv[0]);
            fprintf(stderr, "  M: rows of matrix A and C\n");
            fprintf(stderr, "  K: columns of A and rows of B\n");
            fprintf(stderr, "  N: columns of B and C\n");
        }
        MPI_Finalize();
        return 1;
    }
    
    idx_t M = (idx_t)atoi(argv[1]);  /* rows of A, C */
    idx_t K = (idx_t)atoi(argv[2]);  /* cols of A, rows of B */
    idx_t N = (idx_t)atoi(argv[3]);  /* cols of B, C */
    
    /* Validate dimensions */
    if (M <= 0 || K <= 0 || N <= 0 || M % size != 0) {
        if (rank == 0) {
            fprintf(stderr, "Error: M (%d) must be divisible by number of processes (%d)\n", M, size);
            fprintf(stderr, "Error: All dimensions must be positive\n");
        }
        MPI_Finalize();
        return 1;
    }
    
    /* Calculate local matrix dimensions */
    idx_t local_rows = M / size;  /* Each process gets M/size rows of A */
    
    /* Allocate memory on all processes */
    scalar_t* A_local = (scalar_t*)malloc(local_rows * K * sizeof(scalar_t));
    scalar_t* B_full = (scalar_t*)malloc(K * N * sizeof(scalar_t));
    scalar_t* C_local = (scalar_t*)malloc(local_rows * N * sizeof(scalar_t));
    
    if (!A_local || !B_full || !C_local) {
        fprintf(stderr, "[%d] Memory allocation failed\n", rank);
        MPI_Finalize();
        return 1;
    }
    
    /* Allocate temporary buffers on process 0 for gather operation */
    scalar_t* A_full = NULL;
    scalar_t* C_full = NULL;
    
    if (rank == 0) {
        A_full = (scalar_t*)malloc(M * K * sizeof(scalar_t));
        C_full = (scalar_t*)malloc(M * N * sizeof(scalar_t));
        
        if (!A_full || !C_full) {
            fprintf(stderr, "Process 0: Memory allocation failed\n");
            free(A_local);
            free(B_full);
            free(C_local);
            MPI_Finalize();
            return 1;
        }
        
        /* Initialize matrices on process 0 */
        initialize_matrix(A_full, M, K, 42);
        initialize_matrix(B_full, K, N, 123);
        
        if (rank == 0) {
            printf("Matrix dimensions: A[%d x %d], B[%d x %d], C[%d x %d]\n", 
                   M, K, K, N, M, N);
            printf("Distributed across %d processes\n", size);
            printf("Local problem size per process: [%d x %d] * [%d x %d] = [%d x %d]\n",
                   local_rows, K, K, N, local_rows, N);
        }
    } else {
        zero_matrix(B_full, K, N);
    }
    
    MPI_Barrier(MPI_COMM_WORLD);
    
    double t_start = MPI_Wtime();
    
    /* ========================================================================
     * COMMUNICATION PHASE 1: Scatter matrix A by rows
     * 
     * Each process receives local_rows rows of A
     * MPI_Scatter with non-uniform send counts is implemented via 
     * MPI_Scatterv in production code, but here we assume M is divisible by size
     * ======================================================================== */
    
    MPI_Scatter(A_full,           /* send buffer (only used on root) */
                local_rows * K,   /* send count per process */
                MPI_DOUBLE,       /* send data type */
                A_local,          /* receive buffer */
                local_rows * K,   /* receive count */
                MPI_DOUBLE,       /* receive data type */
                0,                /* root process */
                MPI_COMM_WORLD);  /* communicator */
    
    /* ========================================================================
     * COMMUNICATION PHASE 2: Broadcast matrix B to all processes
     * 
     * All processes need the full B matrix for local computation
     * ======================================================================== */
    
    MPI_Bcast(B_full,
              K * N,
              MPI_DOUBLE,
              0,                /* root process */
              MPI_COMM_WORLD);
    
    /* ========================================================================
     * COMPUTATION PHASE: Local matrix multiplication
     * 
     * Each process computes: C_local[local_rows x N] = A_local[local_rows x K] * B[K x N]
     * 
     * Using blocked algorithm for cache efficiency:
     * - Block size tuned for typical L3 cache (8-16 MB)
     * - Reduces memory traffic and improves spatial locality
     * ======================================================================== */
    
    zero_matrix(C_local, local_rows, N);
    
    /* Blocked matrix multiplication with configurable block size */
    const idx_t BLOCK_SIZE = 64;  /* Tuned for modern CPUs, adjust based on L3 cache */
    
    /* Outer loops over blocks */
    for (idx_t ii = 0; ii < local_rows; ii += BLOCK_SIZE) {
        for (idx_t kk = 0; kk < K; kk += BLOCK_SIZE) {
            for (idx_t jj = 0; jj < N; jj += BLOCK_SIZE) {
                
                /* Inner loops within blocks */
                idx_t i_max = std::min(ii + BLOCK_SIZE, local_rows);
                idx_t k_max = std::min(kk + BLOCK_SIZE, K);
                idx_t j_max = std::min(jj + BLOCK_SIZE, N);
                
                for (idx_t i = ii; i < i_max; ++i) {
                    for (idx_t k = kk; k < k_max; ++k) {
                        scalar_t a_ik = A_local[i * K + k];
                        
                        /* Vectorizable inner loop */
                        for (idx_t j = jj; j < j_max; ++j) {
                            C_local[i * N + j] += a_ik * B_full[k * N + j];
                        }
                    }
                }
            }
        }
    }
    
    /* ========================================================================
     * COMMUNICATION PHASE 3: Gather results from all processes
     * 
     * Process 0 collects all local results into final matrix C
     * ======================================================================== */
    
    MPI_Gather(C_local,           /* send buffer */
               local_rows * N,    /* send count */
               MPI_DOUBLE,        /* send data type */
               C_full,            /* receive buffer (only used on root) */
               local_rows * N,    /* receive count per process */
               MPI_DOUBLE,        /* receive data type */
               0,                 /* root process */
               MPI_COMM_WORLD);
    
    double t_end = MPI_Wtime();
    double elapsed = t_end - t_start;
    
    /* ========================================================================
     * VERIFICATION PHASE: Check correctness on process 0
     * 
     * For production use, implement a reference implementation on smaller data
     * or use mathematical properties to verify results
     * ======================================================================== */
    
    if (rank == 0) {
        /* Compute Frobenius norm of result for basic sanity check */
        scalar_t norm_C = frobenius_norm(C_full, M, N);
        
        /* Compute theoretical norm bounds */
        scalar_t norm_A = frobenius_norm(A_full, M, K);
        scalar_t norm_B = frobenius_norm(B_full, K, N);
        scalar_t expected_norm_lower = norm_A * norm_B / std::sqrt((scalar_t)K);
        scalar_t expected_norm_upper = norm_A * norm_B * std::sqrt((scalar_t)K);
        
        printf("\n=== PERFORMANCE METRICS ===\n");
        printf("Elapsed time: %.4f seconds\n", elapsed);
        
        /* Compute FLOPs: matmul requires 2*M*K*N floating point operations */
        double flops = 2.0 * M * K * N;
        double gflops = flops / elapsed / 1e9;
        printf("Peak FLOPs: %.2e\n", flops);
        printf("Achieved GFLOPs: %.2f\n", gflops);
        
        printf("\n=== VERIFICATION ===\n");
        printf("Frobenius norm of C: %.6e\n", norm_C);
        printf("Expected range: [%.6e, %.6e]\n", expected_norm_lower, expected_norm_upper);
        
        if (norm_C >= expected_norm_lower && norm_C <= expected_norm_upper) {
            printf("✓ Result appears valid\n");
        } else {
            printf("✗ Result may be invalid - norm outside expected range\n");
        }
        
        /* Print first few elements for debugging (if matrices are small) */
        if (M <= 8 && N <= 8) {
            printf("\nResult matrix C (first %d x %d elements):\n", M, N);
            print_matrix(C_full, M, N, "C");
        }
    }
    
    /* ========================================================================
     * CLEANUP
     * ======================================================================== */
    
    free(A_local);
    free(B_full);
    free(C_local);
    
    if (rank == 0) {
        free(A_full);
        free(C_full);
    }
    
    MPI_Finalize();
    
    return 0;
}

/*
 * Initialize matrix with pseudo-random values in range [0, 1)
 * Uses simple LCG for reproducibility
 */
void initialize_matrix(scalar_t* matrix, idx_t rows, idx_t cols, int seed)
{
    const uint32_t a = 1103515245;
    const uint32_t c = 12345;
    const uint32_t m = 2147483648;  /* 2^31 */
    
    uint32_t rng_state = seed;
    scalar_t inv_m = 1.0 / m;
    
    for (idx_t i = 0; i < rows * cols; ++i) {
        rng_state = (a * rng_state + c) % m;
        matrix[i] = (scalar_t)rng_state * inv_m;
    }
}

/*
 * Zero-initialize a matrix
 */
void zero_matrix(scalar_t* matrix, idx_t rows, idx_t cols)
{
    std::memset(matrix, 0, rows * cols * sizeof(scalar_t));
}

/*
 * Compute Frobenius norm: sqrt(sum of all elements squared)
 * Uses Kahan summation for improved numerical stability
 */
scalar_t frobenius_norm(const scalar_t* matrix, idx_t rows, idx_t cols)
{
    scalar_t sum = 0.0;
    scalar_t c = 0.0;  /* Kahan compensation */
    
    for (idx_t i = 0; i < rows * cols; ++i) {
        scalar_t val = matrix[i];
        scalar_t y = val * val - c;
        scalar_t t = sum + y;
        c = (t - sum) - y;
        sum = t;
    }
    
    return std::sqrt(sum);
}

/*
 * Print matrix in formatted output
 * Only for small matrices (debugging)
 */
void print_matrix(const scalar_t* matrix, idx_t rows, idx_t cols, const char* name)
{
    if (rows > 10 || cols > 10) {
        printf("%s: Matrix too large to print (%d x %d)\n", name, rows, cols);
        return;
    }
    
    printf("%s (%d x %d):\n", name, rows, cols);
    for (idx_t i = 0; i < rows; ++i) {
        for (idx_t j = 0; j < cols; ++j) {
            printf("%8.4f ", matrix[i * cols + j]);
        }
        printf("\n");
    }
}
