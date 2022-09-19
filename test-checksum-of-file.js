var crypto = require('crypto');
var fs = require('fs');
const { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } = require("@aws-sdk/client-s3");
const s3 = new S3Client();

// File
var fileName = "file_example_MP4_1280_10MG.mp4";
var filePath = './' + fileName;
var fileKey = fileName;
var buffer = fs.readFileSync(filePath);
// S3 Upload options
var bucket = "bch-test-s3-multipart-upload-bucket";

// Upload
var startTime = new Date();
var partNum = 0;
var partSize = 1024 * 1024 * 5; // Minimum 5MB per chunk (except the last part) http://docs.aws.amazon.com/AmazonS3/latest/API/mpUploadComplete.html
var numPartsLeft = Math.ceil(buffer.length / partSize);
var maxUploadTries = 3;
var multipartMap = {
  Parts: []
};

function completeMultipartUpload(s3, doneParams) {
  const command = new CompleteMultipartUploadCommand(doneParams);
  const response = s3.send(command);
  response.then((output) => {
    var delta = (new Date() - startTime) / 1000;
    console.log('Completed upload in', delta, 'seconds');
    console.log('Final upload data:', output);
  }).catch((error) => {
    console.log("An error occurred while completing the multipart upload");
    console.log(error);
  });
}

function uploadPart(s3, multipart, partParams, tryNum) {
  var tryNum = tryNum || 1;
  const command = new UploadPartCommand(partParams);
  const response = s3.send(command);
  response.then((output) => {
    multipartMap.Parts[command.input.PartNumber - 1] = {
      ETag: output.ETag,
      PartNumber: Number(command.input.PartNumber)
    };
    console.log("Completed part", command.input.PartNumber);
    console.log('mData', output['$metadata']);
    if (--numPartsLeft > 0) return;

    var doneParams = {
      Bucket: bucket,
      Key: fileKey,
      MultipartUpload: multipartMap,
      UploadId: multipart.UploadId,
      ChecksumSHA256: "1RJpCS18Ne2K6c3wAljvEGMPTGPq2mLSik3ydkP8CbE=" //This is a random string: no check is performed
    };

    console.log("Completing upload...");
    completeMultipartUpload(s3, doneParams);
  }).catch((error) => {
    console.log('multiErr, upload part error:', error);
    if (tryNum < maxUploadTries) {
      console.log('Retrying upload of part: #', partParams.PartNumber)
      uploadPart(s3, multipart, partParams, tryNum + 1);
    } else {
      console.log('Failed uploading part: #', partParams.PartNumber)
    }
  });
}

function getChecksumForFile(filename) {
  var sum = crypto.createHash('sha256');
  fs.createReadStream(filename);
  sum.update(fs.readFileSync(filename));
  return sum.digest('base64');
}

var multiPartParams = {
  Bucket: bucket,
  Key: fileKey,
  ContentType: 'application/pdf',
};
// Multipart
console.log("Creating multipart upload for:", fileKey);
const command = new CreateMultipartUploadCommand(multiPartParams);
const response = s3.send(command);
response.then((multipart) => {
  console.log("Got upload ID", multipart.UploadId);

  // Grab each partSize chunk and upload it as a part
  for (var rangeStart = 0; rangeStart < buffer.length; rangeStart += partSize) {
    partNum++;
    var end = Math.min(rangeStart + partSize, buffer.length);
    var body = buffer.slice(rangeStart, end);
    partParams = {
      Body: body,
      Bucket: bucket,
      Key: fileKey,
      PartNumber: String(partNum),
      UploadId: multipart.UploadId
    };

    // Send a single part
    console.log('Uploading part: #', partParams.PartNumber, ', Range start:', rangeStart);
    uploadPart(s3, multipart, partParams);
  }
}).catch((error) => {
  console.log('Error!', error);
});