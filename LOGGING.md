# Logging Guide for Code Stream Extension

This document describes the logging improvements made to the Code Stream extension and how to use and configure logging.

## Overview

Code Stream now uses structured logging in both the Python backend (Tornado) and TypeScript frontend (JupyterLab). This provides:

- **Better debugging**: Structured logs with timestamps and context
- **Production-ready**: Configurable log levels
- **Performance**: Logs can be disabled or filtered at runtime
- **Monitoring**: Easy integration with log aggregation systems

## Python Backend Logging

### Using the Logger

The Python backend uses Python's standard `logging` module:

```python
import logging

logger = logging.getLogger(__name__)

# Log at different levels
logger.debug("Debug message with details")
logger.info("Informational message")
logger.warning("Warning message")
logger.error("Error message", exc_info=True)  # Include stack trace
```

### Log Levels

- `DEBUG`: Detailed information for diagnosing problems
- `INFO`: General informational messages
- `WARNING`: Warning messages for potential issues
- `ERROR`: Error messages for failures

### Configuration

Configure logging level in your Jupyter configuration file:

```python
# jupyter_lab_config.py or jupyter_server_config.py

import logging

# Set global logging level
c.Application.log_level = 'INFO'

# Or configure specific loggers
logging.getLogger('code_stream').setLevel(logging.DEBUG)
```

Or via environment variable:

```bash
export JUPYTER_LOG_LEVEL=DEBUG
jupyter lab
```

### Log Output Example

```
[I 2025-10-31 21:48:33.936 code_stream.redis_client] Successfully added cell abc123 to session XYZ789
[W 2025-10-31 21:48:34.123 code_stream.redis_views] Cell not found for deletion in session XYZ789
[E 2025-10-31 21:48:35.456 code_stream.redis_client] Redis error retrieving cell: Connection refused
```

## TypeScript Frontend Logging

### Using the Logger

The TypeScript frontend uses a custom logger utility:

```typescript
import { logger } from './utils/logger';

// Log at different levels
logger.debug('Debug message', { detail: 'value' });
logger.info('Informational message');
logger.warn('Warning message');
logger.error('Error occurred', error);
```

### Creating Component Loggers

Create a logger for a specific component:

```typescript
import { createLogger, LogLevel } from './utils/logger';

const componentLogger = createLogger('MyComponent', LogLevel.DEBUG);

componentLogger.info('Component initialized');
```

### Log Levels

```typescript
export enum LogLevel {
  DEBUG = 0,    // Detailed debugging information
  INFO = 1,     // General informational messages
  WARN = 2,     // Warning messages
  ERROR = 3,    // Error messages
  NONE = 4      // Disable all logging
}
```

### Configuration

Configure the logger programmatically:

```typescript
import { logger, LogLevel } from './utils/logger';

// Set log level (only logs at this level or higher will be output)
logger.setLevel(LogLevel.WARN);

// Disable console output entirely
logger.setConsoleEnabled(false);
```

Or via browser console:

```javascript
// In browser developer console
logger.setLevel(0); // DEBUG
logger.setLevel(1); // INFO
logger.setLevel(2); // WARN
logger.setLevel(3); // ERROR
logger.setLevel(4); // NONE (disable)
```

### Log Output Example

```
[2025-10-31T21:48:33.936Z] [Code Stream] [INFO] Extension activated
[2025-10-31T21:48:34.123Z] [Code Stream] [DEBUG] Calling push-cell API - endpoint: XYZ789/push-cell/
[2025-10-31T21:48:35.456Z] [Code Stream] [ERROR] Error pushing cell: Network error
```

## Performance Improvements

### Redis Performance Fix

**Critical Change**: Replaced Redis `KEYS` command with `SCAN` iterator.

**Why**: The `KEYS` command:
- Blocks the Redis server during execution
- Performance degrades with dataset size
- Can cause timeouts and service disruptions in production

**Solution**: The `SCAN` command:
- Non-blocking iteration
- Constant performance regardless of dataset size
- Production-safe

```python
# OLD (BLOCKING - DON'T USE)
keys = await self.client.keys(pattern)

# NEW (NON-BLOCKING)
cursor = 0
while True:
    cursor, keys = await self.client.scan(cursor=cursor, match=pattern, count=100)
    # Process keys...
    if cursor == 0:
        break
```

### Redis Connection Pooling

Added connection pooling to reduce overhead:

```python
# Create connection pool
self.pool = async_redis.ConnectionPool(
    host=host,
    port=port,
    db=db,
    max_connections=10  # Reuse connections
)
self.client = async_redis.Redis(connection_pool=self.pool)
```

## Monitoring and Debugging

### Production Deployment

For production deployments:

1. **Python**: Set log level to `INFO` or `WARNING`
2. **TypeScript**: Set log level to `WARN` or `ERROR`

```python
# Python - jupyter_lab_config.py
c.Application.log_level = 'WARNING'
```

```typescript
// TypeScript - in extension activation
logger.setLevel(LogLevel.WARN);
```

### Development

For development:

1. **Python**: Set log level to `DEBUG`
2. **TypeScript**: Set log level to `DEBUG`

### Log Aggregation

Logs can be collected using standard tools:

- **Python**: Use logging handlers (FileHandler, SysLogHandler, etc.)
- **TypeScript**: Browser console or extend logger to send to monitoring service

Example with file logging:

```python
# jupyter_lab_config.py
import logging
from logging.handlers import RotatingFileHandler

handler = RotatingFileHandler(
    'code_stream.log',
    maxBytes=10*1024*1024,  # 10MB
    backupCount=5
)
handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
))

logging.getLogger('code_stream').addHandler(handler)
```

## Migration from Console Statements

### Before (Python)
```python
print(f"Error adding cell: {e}")
```

### After (Python)
```python
logger.error(f"Error adding cell {cell_id}: {e}")
```

### Before (TypeScript)
```typescript
console.log('Code Stream: Extension activated');
console.error('Code Stream: Error:', error);
```

### After (TypeScript)
```typescript
logger.info('Extension activated');
logger.error('Error occurred:', error);
```

## Best Practices

1. **Use appropriate log levels**:
   - `DEBUG`: Detailed diagnostic information
   - `INFO`: General operational messages
   - `WARN`: Potential issues that don't prevent operation
   - `ERROR`: Failures and errors

2. **Include context**:
   ```python
   logger.error(f"Failed to sync cell {cell_id} in session {session_hash}: {error}")
   ```

3. **Don't log sensitive data**:
   ```python
   # BAD
   logger.info(f"Token: {teacher_token}")
   
   # GOOD
   logger.info("Authentication token configured")
   ```

4. **Use structured logging for monitoring**:
   ```python
   logger.info(
       "Cell synced",
       extra={
           'cell_id': cell_id,
           'session': session_hash,
           'duration_ms': duration
       }
   )
   ```

5. **Log errors with context**:
   ```python
   try:
       await redis_client.add_cell(...)
   except RedisError as e:
       logger.error(f"Redis error adding cell {cell_id}: {e}")
   except Exception as e:
       logger.error(f"Unexpected error adding cell {cell_id}: {e}", exc_info=True)
   ```

## Backward Compatibility

All logging changes are backward compatible:

- Python logging uses standard library
- TypeScript logger outputs to console by default
- No configuration changes required
- Existing functionality unchanged

## Future Enhancements

Potential improvements:

1. **Remote logging**: Send logs to centralized monitoring
2. **Performance metrics**: Log operation timings
3. **User activity tracking**: Track usage patterns (with privacy)
4. **Error aggregation**: Integrate with error tracking services
