#include <mpi.h>
#include <cstdlib>
#include <cstdio>
#include <cstring>
#include <algorithm>
#include <cmath>

// Cache block size for tiling - tune for your CPU cache
#define TILE_SIZE 32

// Optimized tiled matrix multiplication
// Computes C[i][j] += A[i][k] * B[k][j] with cache blocking
void matmul_tiled(const double* A_local, const double* B_global, double* C_local,
                  int local_rows, int N) {
    // Zero initialize C
    memset(C_local, 0, local_rows * N * sizeof(double));
    
    // Tile over k dimension (B's rows / A's columns)
    for (int kb = 0; kb < N; kb += TILE_SIZE) {
        int k_end = std::min(kb + TILE_SIZE, N);
        
        // Tile over j dimension (result columns)
        for (int jb = 0; jb < N; jb += TILE_SIZE) {
            int j_end = std::min(jb + TILE_SIZE, N);
            
            // Process local rows
            for (int i = 0; i < local_rows; i++) {
                // Inner tight loop over tile - cache friendly
                for (int k = kb; k < k_end; k++) {
                    double a_ik = A_local[i * N + k];
                    
                    // Unroll j loop for better instruction-level parallelism
                    for (int j = jb; j < j_end; j++) {
                        C_local[i * N + j] += a_ik * B_global[k * N + j];
                    }
                }
            }
        }
    }
}

// Optimized version with manual unrolling and prefetching hints
void matmul_optimized(const double* A_local, const double* B_global, double* C_local,
                      int local_rows, int N) {
    // Zero initialize C
    memset(C_local, 0, local_rows * N * sizeof(double));
    
    // Process with loop unrolling and tiling
    for (int i = 0; i < local_rows; i++) {
        for (int kb = 0; kb < N; kb += TILE_SIZE) {
            int k_end = std::min(kb + TILE_SIZE, N);
            
            for (int jb = 0; jb < N; jb += TILE_SIZE) {
                int j_end = std::min(jb + TILE_SIZE, N);
                
                // Unroll the k loop by 4
                for (int k = kb; k < k_end; k += 4) {
                    // Load A values
                    double a_ik = A_local[i * N + k];
                    double a_ik1 = (k + 1 < k_end) ? A_local[i * N + k + 1] : 0.0;
                    double a_ik2 = (k + 2 < k_end) ? A_local[i * N + k + 2] : 0.0;
                    double a_ik3 = (k + 3 < k_end) ? A_local[i * N + k + 3] : 0.0;
                    
                    // Unroll the j loop by 4
                    int j = jb;
                    for (; j <= j_end - 4; j += 4) {
                        double b0 = B_global[k * N + j];
                        double b1 = B_global[k * N + j + 1];
                        double b2 = B_global[k * N + j + 2];
                        double b3 = B_global[k * N + j + 3];
                        
                        C_local[i * N + j] += a_ik * b0;
                        C_local[i * N + j + 1] += a_ik * b1;
                        C_local[i * N + j + 2] += a_ik * b2;
                        C_local[i * N + j + 3] += a_ik * b3;
                        
                        if (k + 1 < k_end) {
                            C_local[i * N + j] += a_ik1 * B_global[(k + 1) * N + j];
                            C_local[i * N + j + 1] += a_ik1 * B_global[(k + 1) * N + j + 1];
                            C_local[i * N + j + 2] += a_ik1 * B_global[(k + 1) * N + j + 2];
                            C_local[i * N + j + 3] += a_ik1 * B_global[(k + 1) * N + j + 3];
                        }
                        if (k + 2 < k_end) {
                            C_local[i * N + j] += a_ik2 * B_global[(k + 2) * N + j];
                            C_local[i * N + j + 1] += a_ik2 * B_global[(k + 2) * N + j + 1];
                            C_local[i * N + j + 2] += a_ik2 * B_global[(k + 2) * N + j + 2];
                            C_local[i * N + j + 3] += a_ik2 * B_global[(k + 2) * N + j + 3];
                        }
                        if (k + 3 < k_end) {
                            C_local[i * N + j] += a_ik3 * B_global[(k + 3) * N + j];
                            C_local[i * N + j + 1] += a_ik3 * B_global[(k + 3) * N + j + 1];
                            C_local[i * N + j + 2] += a_ik3 * B_global[(k + 3) * N + j + 2];
                            C_local[i * N + j + 3] += a_ik3 * B_global[(k + 3) * N + j + 3];
                        }
                    }
                    
                    // Handle remainder j iterations
                    for (; j < j_end; j++) {
                        C_local[i * N + j] += a_ik * B_global[k * N + j];
                        if (k + 1 < k_end) {
                            C_local[i * N + j] += a_ik1 * B_global[(k + 1) * N + j];
                        }
                        if (k + 2 < k_end) {
                            C_local[i * N + j] += a_ik2 * B_global[(k + 2) * N + j];
                        }
                        if (k + 3 < k_end) {
                            C_local[i * N + j] += a_ik3 * B_global[(k + 3) * N + j];
                        }
                    }
                }
                
                // Handle remainder k iterations
                for (int k = (kb + ((k_end - kb) / 4) * 4); k < k_end; k++) {
                    double a_ik = A_local[i * N + k];
                    for (int j = jb; j < j_end; j++) {
                        C_local[i * N + j] += a_ik * B_global[k * N + j];
                    }
                }
            }
        }
    }
}

int main(int argc, char* argv[]) {
    MPI_Init(&argc, &argv);
    
    int rank, size;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &size);
    
    if (argc != 2) {
        if (rank == 0) {
            fprintf(stderr, "Usage: %s N\n", argv[0]);
            fprintf(stderr, "  N: Size of N x N square matrix\n");
        }
        MPI_Finalize();
        return 1;
    }
    
    int N = atoi(argv[1]);
    
    if (N <= 0) {
        if (rank == 0) {
            fprintf(stderr, "Error: N must be positive\n");
        }
        MPI_Finalize();
        return 1;
    }
    
    // Calculate rows per rank (load balancing for uneven division)
    int base_rows = N / size;
    int extra_rows = N % size;
    int local_rows = base_rows + (rank < extra_rows ? 1 : 0);
    
    // Calculate starting row index for this rank
    int my_start_row = rank * base_rows + std::min(rank, extra_rows);
    
    // Allocate local matrices
    double* A_local = new double[local_rows * N];
    double* B_global = new double[N * N];
    double* C_local = new double[local_rows * N];
    
    // Rank 0: initialize full matrices and prepare for scatter
    double* A_full = nullptr;
    int* sendcounts = nullptr;
    int* displs = nullptr;
    
    if (rank == 0) {
        A_full = new double[N * N];
        sendcounts = new int[size];
        displs = new int[size];
        
        // Initialize A and B with simple values
        for (int i = 0; i < N; i++) {
            for (int j = 0; j < N; j++) {
                A_full[i * N + j] = (double)(i + j) / (N + 1);
                B_global[i * N + j] = (double)(i - j + N) / (N + 1);
            }
        }
        
        // Prepare scatter counts and displacements
        int offset = 0;
        for (int r = 0; r < size; r++) {
            int r_rows = base_rows + (r < extra_rows ? 1 : 0);
            sendcounts[r] = r_rows * N;
            displs[r] = offset;
            offset += sendcounts[r];
        }
    }
    
    // Broadcast B to all ranks
    MPI_Bcast(B_global, N * N, MPI_DOUBLE, 0, MPI_COMM_WORLD);
    
    // Scatter rows of A
    MPI_Scatterv(A_full, sendcounts, displs, MPI_DOUBLE,
                 A_local, local_rows * N, MPI_DOUBLE,
                 0, MPI_COMM_WORLD);
    
    // Perform distributed matrix multiplication
    // Using optimized version with loop unrolling and tiling
    matmul_optimized(A_local, B_global, C_local, local_rows, N);
    
    // Gather results on rank 0
    double* C_full = nullptr;
    if (rank == 0) {
        C_full = new double[N * N];
    }
    
    MPI_Gatherv(C_local, local_rows * N, MPI_DOUBLE,
                 C_full, sendcounts, displs, MPI_DOUBLE,
                 0, MPI_COMM_WORLD);
    
    // Rank 0: verify and display results
    if (rank == 0) {
        // Display result matrix (first 5x5 block)
        int display_size = std::min(5, N);
        printf("Matrix Multiplication Result (C = A * B)\n");
        printf("Matrix size: %d x %d\n", N, N);
        printf("Number of MPI ranks: %d\n\n", size);
        printf("Result matrix C (first %d x %d block):\n", display_size, display_size);
        
        for (int i = 0; i < display_size; i++) {
            for (int j = 0; j < display_size; j++) {
                printf("%10.4f ", C_full[i * N + j]);
            }
            printf("\n");
        }
        
        // Verify correctness with a sample element
        // C[0][0] = sum of A[0][k] * B[k][0]
        double verify = 0.0;
        for (int k = 0; k < N; k++) {
            verify += A_full[k] * B_global[k * N];
        }
        printf("\nVerification: C[0][0] = %.6f (expected: %.6f)\n", 
               C_full[0], verify);
        
        // Cleanup
        delete[] A_full;
        delete[] C_full;
        delete[] sendcounts;
        delete[] displs;
    }
    
    // Cleanup local data
    delete[] A_local;
    delete[] B_global;
    delete[] C_local;
    
    MPI_Finalize();
    return 0;
}
