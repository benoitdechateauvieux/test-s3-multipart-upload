# Validating the integrity of S3 multipart uploads

Code from https://gist.github.com/sevastos/5804803

Links
- https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/getting-started-nodejs.html

To calculate the checksum of a file:
```bash
openssl sha256 -binary ~/Downloads/test.pptx | base64
```
(from https://aws.amazon.com/premiumsupport/knowledge-center/data-integrity-s3/)

## How to run
```bash
npm i
node test.js
```