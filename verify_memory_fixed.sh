#!/bin/bash

# Memory verification script using appropriate account credentials
# Fixed awk syntax issue

# Bamkom account instances
declare -A bamkom_instances
bamkom_instances["i-02676548b8c0438ca"]="23.41%" # Mumbai (user mentioned this one)
bamkom_instances["i-0b181d60e6e2822cb"]="11.05%" # Reference low usage
bamkom_instances["i-0e0d16da8385febc0"]="19.39%" # Reference medium usage

echo "Memory Verification Using Account-Specific Credentials (Fixed)"
echo "=============================================================="
echo ""

# Function to verify Bamkom instances
verify_bamkom_instances() {
    echo "🏢 BAMKOM ACCOUNT INSTANCES"
    echo "=========================="
    
    # Set Bamkom credentials
    export AWS_ACCESS_KEY_ID="$BAMKOM_AWS_ACCESS_KEY_ID"
    export AWS_SECRET_ACCESS_KEY="$BAMKOM_AWS_SECRET_ACCESS_KEY"
    export AWS_DEFAULT_REGION="$BAMKOM_AWS_REGION"
    
    for instance_id in "${!bamkom_instances[@]}"; do
        echo "🔍 Checking Bamkom instance: $instance_id (App shows: ${bamkom_instances[$instance_id]})"
        
        # Use ap-south-1 for Mumbai instances
        REGION="ap-south-1"
        
        # Send SSM command with simplified awk (same as application uses)
        command_id=$(aws ssm send-command \
            --document-name "AWS-RunShellScript" \
            --instance-ids "$instance_id" \
            --parameters 'commands=["free | grep \"^Mem:\" | awk \"{printf \\\"%.2f\\\", (\$3/\$2) * 100.0}\""]' \
            --region "$REGION" \
            --query 'Command.CommandId' \
            --output text 2>/dev/null)
        
        if [ $? -eq 0 ] && [ "$command_id" != "None" ] && [ "$command_id" != "" ]; then
            echo "  📤 Command sent: $command_id"
            
            # Wait for command to complete
            sleep 8
            
            # Get result
            result=$(aws ssm get-command-invocation \
                --command-id "$command_id" \
                --instance-id "$instance_id" \
                --region "$REGION" \
                --query 'StandardOutputContent' \
                --output text 2>/dev/null)
                
            if [ $? -eq 0 ] && [ "$result" != "None" ] && [ "$result" != "" ]; then
                echo "  ✅ Direct SSM Result: ${result}%"
                echo "  📊 Application Shows: ${bamkom_instances[$instance_id]}"
                
                # Calculate difference
                app_value=$(echo "${bamkom_instances[$instance_id]}" | sed 's/%//')
                ssm_value="$result"
                if command -v bc >/dev/null 2>&1; then
                    diff=$(echo "$app_value - $ssm_value" | bc -l)
                    echo "  📈 Difference: ${diff}% (App - SSM)"
                else
                    echo "  📈 App: ${app_value}% vs SSM: ${ssm_value}%"
                fi
                
                # Status check
                if (( $(echo "$result > 80" | bc -l 2>/dev/null || echo 0) )); then
                    echo "  ⚠️  HIGH MEMORY USAGE - Requires attention!"
                elif (( $(echo "$result > 50" | bc -l 2>/dev/null || echo 0) )); then
                    echo "  🔶 Moderate memory usage"
                else
                    echo "  ✅ Normal memory usage"
                fi
                
            else
                echo "  ❌ Failed to get command result"
                # Get error details
                error=$(aws ssm get-command-invocation \
                    --command-id "$command_id" \
                    --instance-id "$instance_id" \
                    --region "$REGION" \
                    --query 'StandardErrorContent' \
                    --output text 2>/dev/null)
                if [ "$error" != "None" ] && [ "$error" != "" ]; then
                    echo "  Error: $error"
                fi
            fi
        else
            echo "  ❌ Failed to send SSM command to Bamkom account"
        fi
        
        echo ""
    done
}

# Load environment variables
if [ -f "/home/ubuntu/augment-ai-aws/.env" ]; then
    source /home/ubuntu/augment-ai-aws/.env
else
    echo "⚠️  .env file not found, using system credentials"
fi

# Run verification
verify_bamkom_instances

echo "✅ Memory verification complete!"