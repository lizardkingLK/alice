#!/bin/bash
set -e

KEY_NAME="alice_key"

# Helper function to print usage guidelines
print_usage() {
    echo "warn. usage for deployment:"
    echo "  $0 apply <AWS_ACCESS_KEY_ID> <AWS_SECRET_ACCESS_KEY> <AWS_REGION>"
    echo ""
    echo "warn. usage for destruction:"
    echo "  $0 destroy <AWS_ACCESS_KEY_ID> <AWS_SECRET_ACCESS_KEY> <AWS_REGION>"
    exit 1
}

# Ensure minimum number of parameters are present
if [ "$#" -ne 4 ]; then
    print_usage
fi

ACTION="$1"
export AWS_ACCESS_KEY_ID="$2"
export AWS_SECRET_ACCESS_KEY="$3"
export TF_VAR_aws_region="$4"

# Handle DESTROY action
if [ "$ACTION" == "destroy" ]; then
    echo "info. initializing Terraform for destruction..."
    terraform init
    
    echo "info. destroying all created AWS infrastructure..."
    terraform destroy -auto-approve
    
    echo "info. infrastructure removed successfully!"
    exit 0

# Handle APPLY action
elif [ "$ACTION" == "apply" ]; then
    # Generate SSH Key Pair if it doesn't exist
    if [ ! -f "./$KEY_NAME" ]; then
        echo "info. generating SSH key pair..."
        ssh-keygen -t rsa -b 4096 -f "./$KEY_NAME" -N ""
        # Secures the private key permissions for SSH
        chmod 400 "./$KEY_NAME"
        echo "info. keys created: ./$KEY_NAME"
    else
        echo "info. SSH key already exists. skipping generation."
    fi

    echo "info. initializing Terraform..."
    terraform init

    echo "info. applying infrastructure changes..."
    terraform apply -auto-approve

    echo "--------------------------------------------------------"
    echo "info. deployment complete!"
    echo "info. to log into your machine, replace 'YOUR_PATH_TO_PRIVATE_KEY' with your actual key file path."
    echo "info. if you are running from this directory, your key is: ./${KEY_NAME}"
    echo "--------------------------------------------------------"
    
    # Extract and display the custom output directly from Terraform
    terraform output ssh_connection_command
    echo "--------------------------------------------------------"

else
    echo "error. invalid action '$ACTION'."
    print_usage
fi
