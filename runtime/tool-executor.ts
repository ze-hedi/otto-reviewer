/**
 * Tool Executor - Safe execution of user-defined tool functions
 * 
 * This module provides utilities for parsing, validating, and executing
 * JavaScript functions stored in the database as strings.
 */

export interface ToolExecutionResult {
  content: Array<{ type: 'text'; text: string }>;
  details?: any;
}

export class ToolExecutor {
  /**
   * Parse and validate a function string
   * Creates a Function object from a string of JavaScript code
   * 
   * @param functionString - JavaScript function body as string
   * @returns Function object that accepts params
   */
  static parseFunction(functionString: string): Function {
    try {
      // Create function with 'params' argument
      // Using Function constructor instead of eval for better control
      const fn = new Function('params', functionString);
      return fn;
    } catch (err: any) {
      throw new Error(`Failed to parse function: ${err.message}`);
    }
  }

  /**
   * Execute a tool function with parameters and timeout protection
   * 
   * @param functionString - JavaScript function body as string
   * @param params - Parameters to pass to the function
   * @param timeout - Maximum execution time in milliseconds (default 5000)
   * @returns Formatted result for PiAgent
   */
  static async executeFunction(
    functionString: string,
    params: any,
    timeout: number = 5000
  ): Promise<ToolExecutionResult> {
    const fn = this.parseFunction(functionString);

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Function execution timeout')), timeout)
    );

    try {
      // Execute function with timeout protection
      const executionPromise = Promise.resolve(fn(params));
      const result = await Promise.race([executionPromise, timeoutPromise]);

      // Format result for PiAgent consumption
      return {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
          },
        ],
        details: result,
      };
    } catch (err: any) {
      throw new Error(`Function execution failed: ${err.message}`);
    }
  }

  /**
   * Validate that a function string is syntactically correct
   * Tests the function with sample parameters
   * 
   * @param functionString - JavaScript function body to validate
   * @returns Validation result with error message if invalid
   */
  static validateFunction(functionString: string): { valid: boolean; error?: string } {
    try {
      const fn = this.parseFunction(functionString);
      
      // Test with empty params object
      const testResult = fn({});
      
      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: err.message };
    }
  }

  /**
   * Create a safe execution wrapper that handles errors gracefully
   * Returns error details instead of throwing
   * 
   * @param functionString - JavaScript function body
   * @param params - Parameters to pass
   * @param timeout - Timeout in milliseconds
   * @returns Result or error object
   */
  static async executeSafely(
    functionString: string,
    params: any,
    timeout: number = 5000
  ): Promise<ToolExecutionResult> {
    try {
      return await this.executeFunction(functionString, params, timeout);
    } catch (err: any) {
      // Return error as tool result instead of throwing
      return {
        content: [
          {
            type: 'text',
            text: `Error executing tool: ${err.message}`,
          },
        ],
        details: {
          error: true,
          message: err.message,
        },
      };
    }
  }
}
