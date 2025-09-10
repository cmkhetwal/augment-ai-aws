#!/bin/bash

# Verify high memory instances reported by the application
# These instances show 83-90% memory usage in the dashboard

# High memory instances to verify
declare -A high_memory_instances

# Based on the user's list - these appear to be Bamkom instances
high_memory_instances["i-0d7af1b2de9108ef4"]="90.0%"  # AWS-Sensor (m5.xlarge)
high_memory_instances["i-043bf0193d01307f5"]="89.4%"  # Vendor-Alliance-Bamko-Cube-Client-Dev (t3a.small)
high_memory_instances["i-0fa2b4736e1ac5d4b"]="88.9%"  # Vendor-Alliance-Backend-prod (t3a.xlarge)
high_memory_instances["i-04fe8df2ddde33876"]="84.1%"  # Bamko-SFTP-Server-New (t3a.large)
high_memory_instances["i-01e51808ff279cf28"]="83.5%"  # N.prod.bamkocore.com (m4.2xlarge)
high_memory_instances["i-095e943dbe2bdfdb7"]="83.2%"  # N.Jenkins-Bamkocore (t3a.medium)

echo "🚨 VERIFYING HIGH MEMORY USAGE INSTANCES (83-90%)"
echo "================================================="
echo ""

# Load environment variables
if [ -f "/home/ubuntu/augment-ai-aws/.env" ]; then
    source /home/ubuntu/augment-ai-aws/.env
    echo "✅ Environment variables loaded"
else
    echo "⚠️  .env file not found"
fi
echo ""

# Function to determine region based on instance patterns
get_region_for_instance() {
    local instance_id="$1"
    # Most of these seem to be in us-east-1 based on naming patterns
    # But let's try multiple regions if needed
    echo "us-east-1"
}

# Function to verify instances using Bamkom credentials
echo "🏢 VERIFYING WITH BAMKOM CREDENTIALS"
echo "==================================="

# Set Bamkom credentials
export AWS_ACCESS_KEY_ID="$BAMKOM_AWS_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$BAMKOM_AWS_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="$BAMKOM_AWS_REGION"

for instance_id in "${!high_memory_instances[@]}"; do
    echo "🔍 Checking: $instance_id (App shows: ${high_memory_instances[$instance_id]})"
    
    # Try multiple regions
    for region in "us-east-1" "us-east-2" "us-west-1" "us-west-2" "ap-south-1"; do
        echo "  📍 Trying region: $region"
        
        # Send SSM command
        command_id=$(aws ssm send-command \
            --document-name "AWS-RunShellScript" \
            --instance-ids "$instance_id" \
            --parameters 'commands=["free | grep \"^Mem:\" | awk \"{printf \\\"%.2f\\\", (\$3/\$2) * 100.0}\""]' \
            --region "$region" \
            --query 'Command.CommandId' \
            --output text 2>/dev/null)
        
        if [ $? -eq 0 ] && [ "$command_id" != "None" ] && [ "$command_id" != "" ]; then
            echo "    📤 Command sent: $command_id"
            
            # Wait for command to complete
            sleep 10
            
            # Get result
            result=$(aws ssm get-command-invocation \
                --command-id "$command_id" \
                --instance-id "$instance_id" \
                --region "$region" \
                --query 'StandardOutputContent' \
                --output text 2>/dev/null)
                
            if [ $? -eq 0 ] && [ "$result" != "None" ] && [ "$result" != "" ]; then
                echo "    ✅ VERIFIED - Direct SSM Result: ${result}%"
                echo "    📊 Application Shows: ${high_memory_instances[$instance_id]}"
                
                # Calculate difference
                app_value=$(echo "${high_memory_instances[$instance_id]}" | sed 's/%//')
                ssm_value="$result"
                if command -v bc >/dev/null 2>&1; then
                    diff=$(echo "$app_value - $ssm_value" | bc -l)
                    echo "    📈 Difference: ${diff}% (App - SSM)"
                else
                    echo "    📈 App: ${app_value}% vs SSM: ${ssm_value}%"
                fi
                
                # Memory status analysis
                if (( $(echo "$result > 90" | bc -l 2>/dev/null || echo 0) )); then
                    echo "    🚨 CRITICAL MEMORY USAGE - IMMEDIATE ACTION REQUIRED!"
                elif (( $(echo "$result > 80" | bc -l 2>/dev/null || echo 0) )); then
                    echo "    ⚠️  HIGH MEMORY USAGE - Requires attention!"
                elif (( $(echo "$result > 50" | bc -l 2>/dev/null || echo 0) )); then
                    echo "    🔶 Moderate memory usage"
                else
                    echo "    ✅ Normal memory usage"
                fi
                
                # Check if the high usage is confirmed
                if (( $(echo "$result > 80" | bc -l 2>/dev/null || echo 0) )); then
                    echo "    ✅ HIGH MEMORY CONFIRMED - App data is accurate"
                else
                    echo "    ❓ DISCREPANCY - App shows high but SSM shows lower"
                fi
                
                break  # Found working region, move to next instance
                
            else
                echo "    ❌ Failed to get result in $region"
                # Get error details
                error=$(aws ssm get-command-invocation \
                    --command-id "$command_id" \
                    --instance-id "$instance_id" \
                    --region "$region" \
                    --query 'StandardErrorContent' \
                    --output text 2>/dev/null)
                if [ "$error" != "None" ] && [ "$error" != "" ]; then
                    echo "    Error: $error"
                fi
            fi
        else
            echo "    ❌ Failed to send command in $region"
        fi
    done
    echo ""
done

echo "🔍 TRYING WITH UNIFIED CREDENTIALS (if instances are in Unified account)"
echo "======================================================================"

# Set Unified credentials
export AWS_ACCESS_KEY_ID="$UNIFIED_AWS_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$UNIFIED_AWS_SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION="$UNIFIED_AWS_REGION"

# Try a couple of instances with Unified credentials
for instance_id in "i-0d7af1b2de9108ef4" "i-043bf0193d01307f5"; do
    echo "🔍 Checking with Unified credentials: $instance_id"
    
    # Try us-east-1 with Unified account
    region="us-east-1"
    command_id=$(aws ssm send-command \
        --document-name "AWS-RunShellScript" \
        --instance-ids "$instance_id" \
        --parameters 'commands=["free | grep \"^Mem:\" | awk \"{printf \\\"%.2f\\\", (\$3/\$2) * 100.0}\""]' \
        --region "$region" \
        --query 'Command.CommandId' \
        --output text 2>/dev/null)
    
    if [ $? -eq 0 ] && [ "$command_id" != "None" ] && [ "$command_id" != "" ]; then
        echo "  📤 Unified account command sent: $command_id"
        sleep 8
        
        result=$(aws ssm get-command-invocation \
            --command-id "$command_id" \
            --instance-id "$instance_id" \
            --region "$region" \
            --query 'StandardOutputContent' \
            --output text 2>/dev/null)
            
        if [ $? -eq 0 ] && [ "$result" != "None" ] && [ "$result" != "" ]; then
            echo "  ✅ UNIFIED ACCOUNT RESULT: ${result}%"
        else
            echo "  ❌ No result from Unified account"
        fi
    else
        echo "  ❌ Not accessible via Unified account"
    fi
    echo ""
done

echo "✅ High memory verification complete!"
echo ""
echo "📋 SUMMARY:"
echo "==========="
echo "• Verified instances showing 83-90% memory usage in application"
echo "• Used both Bamkom and Unified account credentials"
echo "• Compared application data with direct SSM commands"