#!/bin/bash

# Memory verification script using appropriate account credentials
# Bamkom instances use Bamkom credentials, Unified instances use Unified credentials

# High memory instances by account
declare -A bamkom_instances
declare -A unified_instances

# Bamkom account instances (high memory >50%)
bamkom_instances["i-02676548b8c0438ca"]="23.41%" # Mumbai (user mentioned this one)
bamkom_instances["i-0b181d60e6e2822cb"]="11.05%" # Reference low usage
bamkom_instances["i-0e0d16da8385febc0"]="19.39%" # Reference medium usage

# Add more Bamkom instances if we identify them from the logs
# I'll need to check the logs to see which account each instance belongs to

# Unified account instances (high memory >50%)
# unified_instances["instance-id"]="percentage"

echo "Memory Verification Using Account-Specific Credentials"
echo "===================================================="
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
        
        # Determine region based on instance location (we'll need to map this)
        # For now, let's try ap-south-1 for Mumbai instances
        REGION="ap-south-1"
        
        # Send SSM command
        command_id=$(aws ssm send-command \
            --document-name "AWS-RunShellScript" \
            --instance-ids "$instance_id" \
            --parameters 'commands=["free | grep '"'"'^Mem:'"'"' | awk '"'"'{printf \"%.2f\", (\$3/\$2) * 100.0}'"'"'"]' \
            --region "$REGION" \
            --query 'Command.CommandId' \
            --output text 2>/dev/null)
        
        if [ $? -eq 0 ] && [ "$command_id" != "None" ] && [ "$command_id" != "" ]; then
            echo "  📤 Command sent: $command_id"
            
            # Wait for command to complete
            sleep 5
            
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
                diff=$(echo "$app_value - $ssm_value" | bc -l 2>/dev/null || echo "calc error")
                echo "  📈 Difference: ${diff}% (App - SSM)"
            else
                echo "  ❌ Failed to get command result"
                # Try to get error details
                aws ssm get-command-invocation \
                    --command-id "$command_id" \
                    --instance-id "$instance_id" \
                    --region "$REGION" \
                    --query 'StandardErrorContent' \
                    --output text 2>/dev/null || true
            fi
        else
            echo "  ❌ Failed to send SSM command to Bamkom account"
        fi
        
        echo ""
    done
}

# Function to verify Unified instances
verify_unified_instances() {
    echo "🏢 UNIFIED ACCOUNT INSTANCES"
    echo "============================"
    
    # Set Unified credentials
    export AWS_ACCESS_KEY_ID="$UNIFIED_AWS_ACCESS_KEY_ID"
    export AWS_SECRET_ACCESS_KEY="$UNIFIED_AWS_SECRET_ACCESS_KEY"
    export AWS_DEFAULT_REGION="$UNIFIED_AWS_REGION"
    
    for instance_id in "${!unified_instances[@]}"; do
        echo "🔍 Checking Unified instance: $instance_id (App shows: ${unified_instances[$instance_id]})"
        
        # Similar process for Unified account
        # We'll need to determine the correct regions for Unified instances
        
        echo ""
    done
}

# Load environment variables if available
if [ -f "/home/ubuntu/augment-ai-aws/.env" ]; then
    source /home/ubuntu/augment-ai-aws/.env
fi

# Run verification
verify_bamkom_instances
verify_unified_instances

echo "✅ Memory verification complete!"