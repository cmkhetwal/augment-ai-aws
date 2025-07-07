const AWS = require('aws-sdk');

// Configure AWS with environment variables
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const sts = new AWS.STS();

console.log('Testing AWS credentials...');
console.log('Access Key ID:', process.env.AWS_ACCESS_KEY_ID);
console.log('Region:', process.env.AWS_REGION || 'us-east-1');

sts.getCallerIdentity({}, (err, data) => {
  if (err) {
    console.error('❌ AWS Credentials Error:', err.message);
    console.error('Error Code:', err.code);
  } else {
    console.log('✅ AWS Credentials Valid!');
    console.log('Account:', data.Account);
    console.log('User ARN:', data.Arn);
    console.log('User ID:', data.UserId);
  }
});
