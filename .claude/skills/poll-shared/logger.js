/**
 * Shared logger module for poll skills
 *
 * Provides centralized verbosity control with quiet-by-default output.
 * Skills import this module to ensure consistent logging behavior.
 *
 * Usage:
 *   const logger = require('../poll-shared/logger');
 *   logger.info('Progress message');      // Verbose only
 *   logger.debug('Debug detail');         // Verbose only
 *   logger.error('Error message');        // Always shown
 *   logger.success('Success message');    // Always shown
 *   logger.summary('Final summary');      // Always shown
 *
 * Verbosity controlled via --verbose flag:
 *   /poll-draft-emails              # Quiet mode (default)
 *   /poll-draft-emails --verbose    # Verbose mode
 */

class Logger {
  constructor() {
    // Parse --verbose flag once at instantiation
    this.verbose = process.argv.includes('--verbose');
  }

  /**
   * Log info message (shown only in verbose mode)
   * Use for progress messages, step descriptions, process flow
   */
  info(msg) {
    if (this.verbose) {
      console.log(msg);
    }
  }

  /**
   * Log debug message (shown only in verbose mode)
   * Use for detailed debugging info, per-item status, intermediate results
   */
  debug(msg) {
    if (this.verbose) {
      console.log(msg);
    }
  }

  /**
   * Log success message (always shown)
   * Use for successful operations, completion confirmations
   */
  success(msg) {
    console.log(msg);
  }

  /**
   * Log error message (always shown)
   * Use for critical errors that prevent operation completion
   */
  error(msg) {
    console.error(msg);
  }

  /**
   * Log warning message (always shown)
   * Use for non-fatal issues, edge cases, important alerts
   */
  warn(msg) {
    console.warn(msg);
  }

  /**
   * Log summary message (always shown)
   * Use for final one-line result summary
   * In quiet mode, this is typically the ONLY output on success
   */
  summary(msg) {
    console.log(msg);
  }

  /**
   * Check verbosity level for complex conditional logic
   * @returns {boolean} true if --verbose flag is set
   */
  isVerbose() {
    return this.verbose;
  }
}

// Export singleton instance
module.exports = new Logger();
