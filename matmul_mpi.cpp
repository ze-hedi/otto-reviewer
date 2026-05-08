#include <mpi.h>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cmath>
#include <algorithm>

// High-performance MPI matrix multiplication with optimized cache-friendly inner loops
// Matrix A (M x K) distributed row-wise across ranks
// Matrix B (K x N) broadcast to all ranks
// Result C (M x N) gathered at rank 0

// Block size for cache-friendly computation
#define BLOCK_SIZE 64

// Matrix dimensions (can be modified)
#define MATRIX_M 8192
#define MATRIX_K 8192
#define MATRIX_N 8192

typedef double dtype;

struct MatrixData {
    dtype *A;
    dtype *B;
    dtype *C;
    int rows, cols;
};

// Cache-friendly blocked matrix multiplication
// Computes C += A * B for given block ranges
void matmul_blocked(dtype *C, const dtype *A, const dtype *B,
                    int m_start, int m_end, int k, int n) {
    // Block-based computation for better cache locality
    for (int ii = m_start; ii < m_end; ii += BLOCK_SIZE) {
        int ii_end = std::min(ii + BLOCK_SIZE, m_end);
        for (int jj = 0; jj < n; jj += BLOCK_SIZE) {
            int jj_end = std::min(jj + BLOCK_SIZE, n);
            for (int kk = 0; kk < k; kk += BLOCK_SIZE) {
                int kk_end = std::min(kk + BLOCK_SIZE, k);
                
                // Inner triple loop over blocks
                for (int i = ii; i < ii_end; ++i) {
                    for (int j = jj; j < jj_end; ++j) {
                        dtype sum = 0.0;
                        dtype *a_ptr = (dtype *)&A[i * k + kk];
                        dtype *b_ptr = (dtype *)&B[kk * n + j];
                        
                        // Innermost loop: cache-friendly access
                        for (int p = kk; p < kk_end; ++p) {
                            sum += A[i * k + p] * B[p * n + j];
                        }
                        C[i * n + j] += sum;
                    }
                }
            }
        }
    }
}

// Simple matrix multiplication without blocking (for small matrices)
void matmul_simple(dtype *C, const dtype *A, const dtype *B,
                   int m, int k, int n) {
    for (int i = 0; i < m; ++i) {
        for (int j = 0; j < n; ++j) {
            dtype sum = 0.0;
            for (int p = 0; p < k; ++p) {
                sum += A[i * k + p] * B[p * n + j];
            }
            C[i * n + j] = sum;
        }
    }
}

// Optimized inner loop version using registers
void matmul_optimized(dtype *C, const dtype *A, const dtype *B,
                      int m, int k, int n) {
    // Zero-initialize result matrix
    #pragma omp parallel for collapse(2)
    for (int i = 0; i < m; ++i) {
        for (int j = 0; j < n; ++j) {
            C[i * n + j] = 0.0;
        }
    }
    
    // Use cache-friendly computation with prefetching hints
    for (int i = 0; i < m; ++i) {
        dtype *c_row = &C[i * n];
        
        for (int p = 0; p < k; ++p) {
            dtype a_val = A[i * k + p];
            if (a_val != 0.0) {  // Skip zero elements
                dtype *b_row = &B[p * n];
                
                // Vectorizable inner loop
                #pragma omp simd
                for (int j = 0; j < n; ++j) {
                    c_row[j] += a_val * b_row[j];
                }
            }
        }
    }
}

int main(int argc, char **argv) {
    int rank, size;
    int M = MATRIX_M;
    int K = MATRIX_K;
    int N = MATRIX_N;
    
    MPI_Init(&argc, &argv);
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &size);
    
    // Ensure proper distribution
    if (M % size != 0) {
        if (rank == 0) {
            fprintf(stderr, "Error: Matrix rows (M=%d) must be divisible by number of ranks (%d)\n", M, size);
        }
        MPI_Finalize();
        return 1;
    }
    
    int rows_per_rank = M / size;
    int local_m = rows_per_rank;
    
    // Allocate local matrices
    dtype *local_A = (dtype *)malloc(local_m * K * sizeof(dtype));
    dtype *B = (dtype *)malloc(K * N * sizeof(dtype));
    dtype *local_C = (dtype *)malloc(local_m * N * sizeof(dtype));
    
    if (!local_A || !B || !local_C) {
        fprintf(stderr, "Rank %d: Memory allocation failed\n", rank);
        MPI_Finalize();
        return 1;
    }
    
    // Initialize matrices on rank 0
    dtype *A = nullptr;
    if (rank == 0) {
        A = (dtype *)malloc(M * K * sizeof(dtype));
        if (!A) {
            fprintf(stderr, "Rank 0: Memory allocation failed for full A\n");
            MPI_Finalize();
            return 1;
        }
        
        // Simple initialization
        #pragma omp parallel for collapse(2)
        for (int i = 0; i < M; ++i) {
            for (int j = 0; j < K; ++j) {
                A[i * K + j] = (dtype)(i + j) / (dtype)(M + K);
            }
        }
        
        #pragma omp parallel for collapse(2)
        for (int i = 0; i < K; ++i) {
            for (int j = 0; j < N; ++j) {
                B[i * N + j] = (dtype)(i - j) / (dtype)(K + N);
            }
        }
    } else {
        // Non-root ranks only need B
        #pragma omp parallel for
        for (int i = 0; i < K * N; ++i) {
            B[i] = 0.0;
        }
    }
    
    MPI_Barrier(MPI_COMM_WORLD);
    double start_time = MPI_Wtime();
    
    // Scatter rows of A from rank 0 to all ranks
    MPI_Scatter(rank == 0 ? A : nullptr, local_m * K, MPI_DOUBLE,
                local_A, local_m * K, MPI_DOUBLE,
                0, MPI_COMM_WORLD);
    
    // Broadcast B to all ranks
    MPI_Bcast(B, K * N, MPI_DOUBLE, 0, MPI_COMM_WORLD);
    
    // Initialize local result
    #pragma omp parallel for collapse(2)
    for (int i = 0; i < local_m; ++i) {
        for (int j = 0; j < N; ++j) {
            local_C[i * N + j] = 0.0;
        }
    }
    
    // Compute local matrix multiplication with optimization
    if (local_m > 0) {
        matmul_optimized(local_C, local_A, B, local_m, K, N);
    }
    
    // Gather results at rank 0
    dtype *C = nullptr;
    if (rank == 0) {
        C = (dtype *)malloc(M * N * sizeof(dtype));
        if (!C) {
            fprintf(stderr, "Rank 0: Memory allocation failed for C\n");
            MPI_Finalize();
            return 1;
        }
    }
    
    MPI_Gather(local_C, local_m * N, MPI_DOUBLE,
               C, local_m * N, MPI_DOUBLE,
               0, MPI_COMM_WORLD);
    
    MPI_Barrier(MPI_COMM_WORLD);
    double end_time = MPI_Wtime();
    
    // Verification and output on rank 0
    if (rank == 0) {
        double elapsed = end_time - start_time;
        long long ops = 2LL * M * N * K;
        double gflops = (double)ops / (elapsed * 1e9);
        
        printf("=== MPI Matrix Multiplication Results ===\n");
        printf("Matrix dimensions: A(%d x %d) * B(%d x %d) = C(%d x %d)\n", 
               M, K, K, N, M, N);
        printf("Number of MPI ranks: %d\n", size);
        printf("Rows per rank: %d\n", rows_per_rank);
        printf("Computation time: %.6f seconds\n", elapsed);
        printf("Performance: %.2f GFLOP/s\n", gflops);
        printf("Total operations: %lld\n", ops);
        
        // Verify result (sample check)
        if (M <= 512 && N <= 512 && K <= 512) {
            // Quick sanity check
            dtype check_sum = 0.0;
            for (int i = 0; i < M; ++i) {
                for (int j = 0; j < N; ++j) {
                    check_sum += C[i * N + j];
                }
            }
            printf("Result checksum (sample): %.6e\n", check_sum);
        }
        
        free(A);
        free(C);
    }
    
    // Cleanup
    free(local_A);
    free(B);
    free(local_C);
    
    MPI_Finalize();
    return 0;
}
