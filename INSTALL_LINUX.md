# Code Stream - Linux Installation Guide

This guide covers installing the Code Stream JupyterLab extension on a Linux system directly from the GitHub repository for testing purposes.

## Prerequisites

Before installing, ensure you have the following:

- **Python**: 3.9 or higher
- **JupyterLab**: 4.0.0 or higher
- **Node.js**: 14.x or higher (for building the extension)
- **npm/yarn**: Latest version
- **Redis server**: Required for teachers only (not needed for students)
- **Git**: For cloning the repository

### Installing Prerequisites on Linux

```bash
# Update package manager
sudo apt update

# Install Python 3.9+ (if not already installed)
sudo apt install python3 python3-pip python3-venv

# Install Node.js and npm (using NodeSource repository for latest version)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Git
sudo apt install git

# Verify installations
python3 --version
node --version
npm --version
git --version
```

## Installation Methods

Choose one of the following installation methods based on your use case.

### Method 1: Development Installation (Recommended for Testing)

This method creates an editable installation, allowing you to test and modify the extension.

#### Step 1: Clone the Repository

```bash
# Navigate to your preferred directory
cd ~

# Clone the repository
git clone https://github.com/RETR0-OS/code_stream.git

# Navigate into the project directory
cd code_stream
```

#### Step 2: Create a Virtual Environment (Recommended)

```bash
# Create a virtual environment
python3 -m venv venv

# Activate the virtual environment
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip
```

#### Step 3: Install Python Dependencies

```bash
# Install the extension in development mode
pip install -e .
```

This will install all Python dependencies including:
- `jupyter_server>=2.4.0`
- `notebook>=7.4.7`
- `redis>=6.4.0`

#### Step 4: Install Node.js Dependencies

```bash
# Install jlpm (JupyterLab's package manager) if not already available
npm install -g yarn

# Install Node.js dependencies
jlpm install
# Or alternatively: npm install
```

#### Step 5: Build and Install the Extension

```bash
# Build the TypeScript code and extension
jlpm run build

# Link the extension to JupyterLab
jupyter labextension develop . --overwrite
```

#### Step 6: Verify Installation

```bash
# List installed JupyterLab extensions
jupyter labextension list

# You should see "code_stream" in the list
```

#### Step 7: Start JupyterLab

```bash
# Start JupyterLab
jupyter lab

# The extension should now be available in the left sidebar
```

### Method 2: Production Build Installation

This method creates a production build suitable for deployment.

#### Steps 1-4: Same as Development Installation

Follow steps 1-4 from Method 1 above.

#### Step 5: Build Production Version

```bash
# Clean any previous builds
jlpm run clean:all

# Build production version
jlpm run build:prod

# Install the built extension
pip install .
```

#### Step 6: Start JupyterLab

```bash
jupyter lab
```

## Redis Installation (Teachers Only)

Students do not need Redis. Teachers require a running Redis server to store and share cell data.

### Option 1: Install Redis Using Docker (Recommended)

```bash
# Install Docker if not already installed
sudo apt install docker.io

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# Run Redis container
sudo docker run -d -p 6379:6379 --name code-stream-redis redis:latest

# Verify Redis is running
sudo docker ps
```

### Option 2: Install Redis Natively

```bash
# Install Redis
sudo apt install redis-server

# Start Redis service
sudo systemctl start redis-server
sudo systemctl enable redis-server

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

### Configure Redis Connection (Optional)

By default, Code Stream connects to Redis at `localhost:6379`. To customize:

```bash
# Set environment variables (add to ~/.bashrc or ~/.bash_profile for persistence)
export REDIS_HOST="localhost"
export REDIS_PORT="6379"
export REDIS_DB="0"
```

## Troubleshooting

### Extension Not Appearing in JupyterLab

1. Verify the extension is installed:
   ```bash
   jupyter labextension list
   ```

2. Rebuild JupyterLab:
   ```bash
   jupyter lab build
   ```

3. Clear browser cache and restart JupyterLab.

### Build Errors

If you encounter build errors:

```bash
# Clean all build artifacts
jlpm run clean:all

# Remove node_modules and reinstall
rm -rf node_modules
jlpm install

# Rebuild
jlpm run build
```

### Permission Errors

If you encounter permission errors when installing:

```bash
# Use pip with --user flag
pip install --user -e .

# Or use sudo (not recommended for development)
sudo pip install -e .
```

### Node.js/npm Issues

If `jlpm` is not found:

```bash
# Install Yarn globally
npm install -g yarn

# Or use npm directly instead of jlpm
npm install
npm run build
```

## Network Configuration for Student-Teacher Setup

### For Teachers

1. Find your local IP address:
   ```bash
   ip addr show
   # Or: hostname -I
   ```

2. Start JupyterLab with network binding:
   ```bash
   jupyter lab --ip=0.0.0.0 --port=8888
   ```

3. Configure firewall to allow incoming connections:
   ```bash
   # Allow JupyterLab port
   sudo ufw allow 8888/tcp

   # Allow Redis port (if students need direct access - not typical)
   sudo ufw allow 6379/tcp
   ```

4. Share with students:
   - Your IP address (e.g., `192.168.1.10`)
   - JupyterLab port (e.g., `8888`)
   - Your Jupyter server token (found by running `jupyter server list`)

### For Students

1. Configure teacher server in Code Stream sidebar:
   - Enter teacher's URL: `http://<teacher-ip>:8888`
   - Enter teacher's token (provided by teacher)
   - Click "Save" and "Test Connection"

## Development Workflow

For active development with hot-reload:

```bash
# Terminal 1: Watch TypeScript files for changes
jlpm run watch

# Terminal 2: Start JupyterLab with auto-reload
jupyter lab --autoreload
```

Any changes to TypeScript files will automatically rebuild, and JupyterLab will reload the extension.

## Updating the Extension

To update to the latest version:

```bash
# Navigate to the project directory
cd ~/code_stream

# Pull latest changes
git pull origin main

# Reinstall dependencies if needed
pip install -e .
jlpm install

# Rebuild
jlpm run build

# Restart JupyterLab
```

## Uninstalling

To completely remove the extension:

```bash
# Uninstall the JupyterLab extension
jupyter labextension uninstall code_stream

# Uninstall the Python package
pip uninstall code_stream

# Optional: Remove the cloned repository
cd ~
rm -rf code_stream
```

## System Requirements

- **Minimum**:
  - 2 GB RAM
  - 500 MB disk space
  - Python 3.9+
  - Node.js 14+

- **Recommended**:
  - 4 GB RAM
  - 1 GB disk space
  - Python 3.10+
  - Node.js 18+

## Security Considerations

### For Production Use

1. **Use HTTPS**: Configure JupyterLab with SSL certificates
   ```bash
   jupyter lab --certfile=/path/to/cert.pem --keyfile=/path/to/key.pem
   ```

2. **Set a strong token**:
   ```bash
   jupyter lab --IdentityProvider.token='your-strong-token-here'
   ```

3. **Use a firewall**: Restrict access to trusted IP ranges
   ```bash
   sudo ufw allow from 192.168.1.0/24 to any port 8888
   ```

4. **Keep Redis secure**: Don't expose Redis port publicly, or use authentication

## Testing the Installation

1. **Start JupyterLab**:
   ```bash
   jupyter lab
   ```

2. **Open the Code Stream sidebar** (left sidebar icon)

3. **For teachers**:
   - Verify session code appears automatically
   - Create a notebook and enable sync on a cell

4. **For students**:
   - Configure teacher server URL
   - Test connection
   - Join a session using teacher's code

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the main [README.md](README.md) for usage instructions
3. Check existing issues: https://github.com/RETR0-OS/code_stream/issues
4. Create a new issue with:
   - Linux distribution and version
   - Python version (`python3 --version`)
   - Node.js version (`node --version`)
   - JupyterLab version (`jupyter lab --version`)
   - Full error messages and logs

## Quick Reference

```bash
# Complete installation (development mode)
git clone https://github.com/RETR0-OS/code_stream.git
cd code_stream
python3 -m venv venv
source venv/bin/activate
pip install -e .
jlpm install
jlpm run build
jupyter labextension develop . --overwrite
jupyter lab

# Start Redis (teachers only)
sudo docker run -d -p 6379:6379 redis:latest

# Development mode with hot-reload
jlpm run watch              # Terminal 1
jupyter lab --autoreload    # Terminal 2
```
