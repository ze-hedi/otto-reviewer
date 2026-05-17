#include <iostream>
#include <queue>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <chrono>
#include <vector>

// Thread-safe queue for multiple producers and consumers
template <typename T>
class ThreadSafeQueue {
private:
    mutable std::mutex mutex_;
    std::queue<T> queue_;
    std::condition_variable cond_var_;

public:
    ThreadSafeQueue() {}

    // Delete copy operations
    ThreadSafeQueue(const ThreadSafeQueue&) = delete;
    ThreadSafeQueue& operator=(const ThreadSafeQueue&) = delete;

    // Push an item to the queue
    void push(T value) {
        {
            std::lock_guard<std::mutex> lock(mutex_);
            queue_.push(value);
        }
        cond_var_.notify_one();  // Notify waiting consumers
    }

    // Pop an item from the queue (blocking operation)
    T pop() {
        std::unique_lock<std::mutex> lock(mutex_);
        // Wait until queue is not empty
        cond_var_.wait(lock, [this]() { return !queue_.empty(); });
        
        T value = queue_.front();
        queue_.pop();
        return value;
    }

    // Non-blocking pop with timeout
    bool try_pop(T& value, int timeout_ms = 100) {
        std::unique_lock<std::mutex> lock(mutex_);
        if (!cond_var_.wait_for(lock, std::chrono::milliseconds(timeout_ms),
                                [this]() { return !queue_.empty(); })) {
            return false;
        }
        value = queue_.front();
        queue_.pop();
        return true;
    }

    // Check if queue is empty
    bool empty() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return queue_.empty();
    }

    // Get queue size
    size_t size() const {
        std::lock_guard<std::mutex> lock(mutex_);
        return queue_.size();
    }
};

// Producer function
void producer(ThreadSafeQueue<int>& queue, int id, int items_to_produce) {
    for (int i = 0; i < items_to_produce; ++i) {
        int value = id * 1000 + i;
        queue.push(value);
        std::cout << "Producer " << id << " produced: " << value << std::endl;
        
        // Simulate some work
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }
    std::cout << "Producer " << id << " finished!" << std::endl;
}

// Consumer function
void consumer(ThreadSafeQueue<int>& queue, int id) {
    int consumed = 0;
    while (consumed < 10) {  // Consume 10 items
        int value;
        if (queue.try_pop(value, 500)) {
            std::cout << "Consumer " << id << " consumed: " << value << std::endl;
            consumed++;
        } else {
            std::cout << "Consumer " << id << " timed out waiting for item" << std::endl;
        }
        
        // Simulate some processing work
        std::this_thread::sleep_for(std::chrono::milliseconds(150));
    }
    std::cout << "Consumer " << id << " finished!" << std::endl;
}

int main() {
    ThreadSafeQueue<int> queue;
    
    std::cout << "=== Multiple Producer, Multiple Consumer Queue Demo ===" << std::endl;
    std::cout << std::endl;
    
    // Create producer and consumer threads
    std::vector<std::thread> threads;
    
    // Create 3 producers
    std::cout << "Starting 3 producers..." << std::endl;
    for (int i = 1; i <= 3; ++i) {
        threads.emplace_back(producer, std::ref(queue), i, 4);
    }
    
    // Create 2 consumers
    std::cout << "Starting 2 consumers..." << std::endl;
    for (int i = 1; i <= 2; ++i) {
        threads.emplace_back(consumer, std::ref(queue), i);
    }
    
    std::cout << std::endl;
    
    // Wait for all threads to complete
    for (auto& thread : threads) {
        thread.join();
    }
    
    std::cout << std::endl;
    std::cout << "=== All threads completed ===" << std::endl;
    std::cout << "Final queue size: " << queue.size() << std::endl;
    
    return 0;
}
