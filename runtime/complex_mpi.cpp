#include <mpi.h>
#include <iostream>
#include <vector>
#include <cmath>
#include <iomanip>
#include <cstring>

// Custom data structure for particles
struct Particle {
    double x, y, z;           // Position
    double vx, vy, vz;        // Velocity
    double mass;              // Mass
    int id;                   // Particle ID
};

// Function to initialize particle data
Particle createParticle(int id, double mass) {
    Particle p;
    p.id = id;
    p.mass = mass;
    p.x = static_cast<double>(id) * 0.1;
    p.y = static_cast<double>(id) * 0.2;
    p.z = static_cast<double>(id) * 0.15;
    p.vx = static_cast<double>(id) * 0.01;
    p.vy = static_cast<double>(id) * 0.02;
    p.vz = static_cast<double>(id) * 0.015;
    return p;
}

// Function to calculate distance between particles
double distance(const Particle& p1, const Particle& p2) {
    double dx = p2.x - p1.x;
    double dy = p2.y - p1.y;
    double dz = p2.z - p1.z;
    return std::sqrt(dx*dx + dy*dy + dz*dz);
}

// Custom MPI reduction operation for maximum distance
void max_distance_op(void* in, void* inout, int* len, MPI_Datatype* dtype) {
    double* in_val = static_cast<double*>(in);
    double* inout_val = static_cast<double*>(inout);
    for (int i = 0; i < *len; i++) {
        inout_val[i] = std::max(inout_val[i], in_val[i]);
    }
}

int main(int argc, char** argv) {
    // Initialize MPI
    MPI_Init(&argc, &argv);
    
    int rank, size;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &size);
    
    // Create custom MPI datatype for Particle
    MPI_Datatype particle_type;
    int block_counts[4] = {3, 3, 1, 1};
    MPI_Datatype block_types[4] = {MPI_DOUBLE, MPI_DOUBLE, MPI_DOUBLE, MPI_INT};
    MPI_Aint displacements[4];
    
    Particle dummy;
    MPI_Get_address(&dummy, &displacements[0]);
    MPI_Get_address(&dummy.vx, &displacements[1]);
    MPI_Get_address(&dummy.mass, &displacements[2]);
    MPI_Get_address(&dummy.id, &displacements[3]);
    
    for (int i = 3; i >= 0; i--) {
        displacements[i] -= displacements[0];
    }
    displacements[0] = 0;
    
    MPI_Type_create_struct(4, block_counts, displacements, block_types, &particle_type);
    MPI_Type_commit(&particle_type);
    
    // Create custom operation for maximum distance
    MPI_Op max_dist_op;
    MPI_Op_create(max_distance_op, 1, &max_dist_op);
    
    // Simulation parameters
    const int particles_per_rank = 5;
    const int total_particles = size * particles_per_rank;
    const int timesteps = 3;
    
    // Initialize local particles
    std::vector<Particle> particles;
    for (int i = 0; i < particles_per_rank; i++) {
        int global_id = rank * particles_per_rank + i;
        particles.push_back(createParticle(global_id, 1.0 + global_id * 0.1));
    }
    
    if (rank == 0) {
        std::cout << "=== Complex MPI N-Body Simulation ===" << std::endl;
        std::cout << "Processes: " << size << ", Particles per rank: " << particles_per_rank << std::endl;
        std::cout << "Total particles: " << total_particles << ", Timesteps: " << timesteps << std::endl;
        std::cout << "=========================================\n" << std::endl;
    }
    
    // Simulation loop
    for (int ts = 0; ts < timesteps; ts++) {
        // Gather all particles at rank 0 using non-blocking communication
        std::vector<Particle> all_particles(total_particles);
        
        // Use MPI_Allgather for efficient particle distribution
        MPI_Allgather(particles.data(), particles_per_rank, particle_type,
                      all_particles.data(), particles_per_rank, particle_type,
                      MPI_COMM_WORLD);
        
        // Calculate forces and update velocities
        double max_dist = 0.0;
        for (size_t i = 0; i < particles.size(); i++) {
            double fx = 0.0, fy = 0.0, fz = 0.0;
            
            for (int j = 0; j < total_particles; j++) {
                if (static_cast<int>(rank * particles_per_rank + i) != j) {
                    double dist = distance(particles[i], all_particles[j]);
                    if (dist > 1e-6) {
                        double force = all_particles[j].mass / (dist * dist + 1e-3);
                        max_dist = std::max(max_dist, dist);
                        
                        double dx = all_particles[j].x - particles[i].x;
                        double dy = all_particles[j].y - particles[i].y;
                        double dz = all_particles[j].z - particles[i].z;
                        double norm = dist;
                        
                        fx += force * dx / norm;
                        fy += force * dy / norm;
                        fz += force * dz / norm;
                    }
                }
            }
            
            // Update velocities and positions
            double dt = 0.01;
            particles[i].vx += fx * dt / particles[i].mass;
            particles[i].vy += fy * dt / particles[i].mass;
            particles[i].vz += fz * dt / particles[i].mass;
            
            particles[i].x += particles[i].vx * dt;
            particles[i].y += particles[i].vy * dt;
            particles[i].z += particles[i].vz * dt;
        }
        
        // Perform global reduction to find maximum distance
        double global_max_dist = 0.0;
        MPI_Allreduce(&max_dist, &global_max_dist, 1, MPI_DOUBLE, MPI_MAX, MPI_COMM_WORLD);
        
        // Calculate local energy
        double local_energy = 0.0;
        for (size_t i = 0; i < particles.size(); i++) {
            double v_sq = particles[i].vx * particles[i].vx + 
                         particles[i].vy * particles[i].vy + 
                         particles[i].vz * particles[i].vz;
            local_energy += 0.5 * particles[i].mass * v_sq;
        }
        
        double total_energy = 0.0;
        MPI_Reduce(&local_energy, &total_energy, 1, MPI_DOUBLE, MPI_SUM, 0, MPI_COMM_WORLD);
        
        // Output timestep information
        if (rank == 0) {
            std::cout << "Timestep " << ts << ":" << std::endl;
            std::cout << "  Max distance: " << std::setprecision(6) << global_max_dist << std::endl;
            std::cout << "  Total energy: " << std::setprecision(8) << total_energy << std::endl;
        }
        
        // Non-blocking send/receive pattern for load balancing
        if (size > 1) {
            int next_rank = (rank + 1) % size;
            int prev_rank = (rank - 1 + size) % size;
            
            MPI_Request send_req, recv_req;
            Particle ghost_particle;
            
            if (particles.size() > 0) {
                MPI_Isend(&particles[0], 1, particle_type, next_rank, 
                         ts * 100 + rank, MPI_COMM_WORLD, &send_req);
                MPI_Irecv(&ghost_particle, 1, particle_type, prev_rank, 
                         ts * 100 + prev_rank, MPI_COMM_WORLD, &recv_req);
                
                MPI_Wait(&send_req, MPI_STATUS_IGNORE);
                MPI_Wait(&recv_req, MPI_STATUS_IGNORE);
            }
        }
        
        // Synchronization barrier
        MPI_Barrier(MPI_COMM_WORLD);
    }
    
    // Print final state (rank 0 only)
    if (rank == 0) {
        std::cout << "\n=== Final Particle States ===" << std::endl;
    }
    
    std::vector<Particle> gathered_particles(rank == 0 ? total_particles : 0);
    MPI_Gather(particles.data(), particles_per_rank, particle_type,
               rank == 0 ? gathered_particles.data() : nullptr, particles_per_rank, particle_type,
               0, MPI_COMM_WORLD);
    
    if (rank == 0) {
        for (int i = 0; i < total_particles; i++) {
            std::cout << "Particle " << i << ": pos=(" 
                     << std::setprecision(4) << gathered_particles[i].x << ", "
                     << gathered_particles[i].y << ", "
                     << gathered_particles[i].z << "), "
                     << "vel=(" << gathered_particles[i].vx << ", "
                     << gathered_particles[i].vy << ", "
                     << gathered_particles[i].vz << "), "
                     << "mass=" << gathered_particles[i].mass << std::endl;
        }
    }
    
    // Cleanup
    MPI_Type_free(&particle_type);
    MPI_Op_free(&max_dist_op);
    MPI_Finalize();
    
    return 0;
}
