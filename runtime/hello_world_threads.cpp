#include <iostream>
#include <thread>
#include <vector>

void printHelloWorld(int threadId) {
    std::cout << "Thread " << threadId << ": Hello World" << std::endl;
}

int main() {
    std::vector<std::thread> threads;
    
    // Create 10 threads
    for (int i = 0; i < 10; i++) {
        threads.emplace_back(printHelloWorld, i);
    }
    
    // Join all threads (wait for them to finish)
    for (auto& t : threads) {
        t.join();
    }
    
    std::cout << "All threads completed!" << std::endl;
    
    return 0;
}
