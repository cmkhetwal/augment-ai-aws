#!/bin/bash

# High memory instances to verify (App shows >50% memory usage)
declare -A instances
instances["i-0e41ebb72b6deaa76"]="93.75%"
instances["i-0f8d6a56815ca509a"]="86.45%"
instances["i-0e50f1e1b0ea68b31"]="86.60%"
instances["i-0cf981c0b76724252"]="84.78%"
instances["i-01b2a52c48edb0d29"]="83.50%"
instances["i-0fb4dc6dd0d268adf"]="78.17%"
instances["i-0a5265bddad9411db"]="75.06%"
instances["i-00646787326516bd1"]="70.39%"
instances["i-05913c6c0e3f8fbc6"]="62.82%"
instances["i-0d7af1b2de9108ef4"]="59.18%"
instances["i-06a5161b3f6d14fb9"]="55.94%"
instances["i-0ed41b4a01121ea23"]="54.63%"
instances["i-0f462cdb4fd502899"]="51.90%"
instances["i-007627604f632c437"]="51.63%"
instances["i-03377700ad0531bd2"]="51.12%"

echo "Verification of High Memory Usage Instances"
echo "==========================================="
echo ""

for instance_id in "${!instances[@]}"; do
    echo "Checking instance: $instance_id (App shows: ${instances[$instance_id]})"
    
    # Send SSM command
    command_id=$(aws ssm send-command \
        --document-name "AWS-RunShellScript" \
        --instance-ids "$instance_id" \
        --parameters 'commands=["free | grep '"'"'^Mem:'"'"' | awk '"'"'{printf \"%.2f\\n\", ($3/$2) * 100.0}'"'"'"]' \
        --query 'Command.CommandId' \
        --output text 2>/dev/null)
    
    if [ $? -eq 0 ] && [ "$command_id" != "None" ]; then
        echo "  Command ID: $command_id"
        
        # Wait for command to complete
        sleep 3
        
        # Get result
        result=$(aws ssm get-command-invocation \
            --command-id "$command_id" \
            --instance-id "$instance_id" \
            --query 'StandardOutputContent' \
            --output text 2>/dev/null)
            
        if [ $? -eq 0 ] && [ "$result" != "None" ]; then
            echo "  ✓ Direct SSM Result: ${result}%"
            echo "  📊 Application Shows: ${instances[$instance_id]}"
            
            # Calculate difference
            app_value=$(echo "${instances[$instance_id]}" | sed 's/%//')
            ssm_value="$result"
            diff=$(echo "$app_value - $ssm_value" | bc -l)
            echo "  📈 Difference: ${diff}% (App - SSM)"
        else
            echo "  ❌ Failed to get command result"
        fi
    else
        echo "  ❌ Failed to send SSM command"
    fi
    
    echo ""
done