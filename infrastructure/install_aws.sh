#!/bin/bash
set -e

echo "info. Updating system packages..."
sudo apt-get update -y

echo "info. Installing AWS CLI natively..."
sudo apt-get install -y awscli

echo "info. AWS CLI installed successfully!"
aws --version
