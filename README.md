# Validating the integrity of S3 multipart uploads

Original code from https://gist.github.com/sevastos/5804803

Sources
- https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/getting-started-nodejs.html
- https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/classes/uploadpartcommand.html
- https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#completeMultipartUpload-property
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html

To calculate the checksum of a file:
```bash
openssl sha256 -binary ~/Downloads/test.pptx | base64
```
from https://aws.amazon.com/premiumsupport/knowledge-center/data-integrity-s3/

## How to run
1. Export AWS credentials as Environment Variables
2. Create a S3 bucket for testing and replace the name in the JS code source (variable `bucket`)
4. Run the test files
```bash
npm i
node test-checksum-of-file.js
node test-checksum-of-parts.js
```