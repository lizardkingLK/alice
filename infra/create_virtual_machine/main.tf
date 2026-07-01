terrform {
    required_providers {
        aws = {
            source  = "hashicorp/aws"
            version = "~> 5.0"
        }
    }
}

# Configure the AWS Provider
provider "aws" {
    region = var.aws_region
}

# Input variables passed from the environment/script
variable "aws_region" {
    type    = string
    default = "us-east-1"
}

variable "public_key_path" {
    type    = string
    default = "~/.ssh/alice_key.pub"
}

# 1. Fetch existing default VPC
data "aws_vpc" "default" {
    default = true
}

# 2. Fetch the existing default Security Group in VPC
data "aws_security_group" "default_sg" {
    vpc_id  = data.aws_vpc.default.id
    name    = "default"
}

# 3. Dynamic Upsert: Ensuer Port 22 (SSH) is open to the world on the default group
resource "aws_vpc_security_group_ingress_rule" "allow_ssh" {
  security_group_id = data.aws_security_group.default_sg.id
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 22
  ip_protocol       = "tcp"
  to_port           = 22
  tags = {
    Name = "terraform-managed-ssh"
  }
}

# 4. Register the SSH Public Key with AWS
resource "aws_key_pair" "deployer_key" {
    key_name    = "vm-ssh-key"
    public_key  = file(var.public_key_path)
}

# 5. Create an AWS EC2 Instance (Virtual Machine)
resource "aws_instance" "my_vm" {
    ami                     = "ami-0c7217cdde317cfec"
    instance_type           = "t2.micro"
    key_name                = aws_key_pair.deployer_key.key_name
    vpc_secuirty_group_ids  = [data.aws_secuirty_group.default_sg.id]

    tags = {
        Name = "MyAutomatedVM"
    }
}

# 6. Output the formatted SSH login command
output "ssh_connection_command" {
  description = "The terminal command required to connect to your new VM"
  value       = "ssh -i YOUR_PATH_TO_PRIVATE_KEY ubuntu@${aws_instance.my_vm.public_ip}"
}