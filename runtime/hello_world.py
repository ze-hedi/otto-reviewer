import numpy as np

def matrix_multiply():
    """
    Perform numpy matmul of two 10x10 random matrices.
    Returns the result of the matrix multiplication.
    """
    # Create two random 10x10 matrices
    matrix_a = np.random.rand(10, 10)
    matrix_b = np.random.rand(10, 10)
    
    # Perform matrix multiplication
    result = np.matmul(matrix_a, matrix_b)
    
    return result, matrix_a, matrix_b


def test_matrix_multiply():
    """Test the matrix_multiply function."""
    print("Testing matrix_multiply function...")
    print("-" * 50)
    
    result, matrix_a, matrix_b = matrix_multiply()
    
    print(f"Matrix A shape: {matrix_a.shape}")
    print(f"Matrix B shape: {matrix_b.shape}")
    print(f"Result shape: {result.shape}")
    print()
    
    print("Matrix A (first 3x3):")
    print(matrix_a[:3, :3])
    print()
    
    print("Matrix B (first 3x3):")
    print(matrix_b[:3, :3])
    print()
    
    print("Result (first 3x3):")
    print(result[:3, :3])
    print()
    
    # Verify the shape is correct
    assert result.shape == (10, 10), "Result shape should be (10, 10)"
    print("✓ Test passed! Matrix multiplication successful.")
    
    return result


if __name__ == "__main__":
    test_matrix_multiply()
