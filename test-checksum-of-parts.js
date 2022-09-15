var crypto = require('crypto');
var fs = require('fs');
var AWS = require('aws-sdk');
var s3 = new AWS.S3();

// File
var fileName = "test.pptx";
var filePath = '/Users/chateauv/Downloads/' + fileName;
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
var multiPartParams = {
    Bucket: bucket,
    Key: fileKey,
    ContentType: 'application/pdf',
    ChecksumAlgorithm: "SHA256",
};
var multipartMap = {
    Parts: []
};

function completeMultipartUpload(s3, doneParams) {
  s3.completeMultipartUpload(doneParams, function(err, data) {
    if (err) {
      console.log("An error occurred while completing the multipart upload");
      console.log(err);
    } else {
      var delta = (new Date() - startTime) / 1000;
      console.log('Completed upload in', delta, 'seconds');
      console.log('Final upload data:', data);
    }
  });
}

function uploadPart(s3, multipart, partParams, tryNum) {
  var tryNum = tryNum || 1;
  s3.uploadPart(partParams, function(multiErr, mData) {
    if (multiErr){
      console.log('multiErr, upload part error:', multiErr);
      if (tryNum < maxUploadTries) {
        console.log('Retrying upload of part: #', partParams.PartNumber)
        uploadPart(s3, multipart, partParams, tryNum + 1);
      } else {
        console.log('Failed uploading part: #', partParams.PartNumber)
      }
      return;
    }
    multipartMap.Parts[this.request.params.PartNumber - 1] = {
      ETag: mData.ETag,
      PartNumber: Number(this.request.params.PartNumber),
      ChecksumSHA256: this.request.params.ChecksumSHA256
    };
    console.log("Completed part", this.request.params.PartNumber);
    console.log('mData', mData);
    if (--numPartsLeft > 0) return;

    var doneParams = {
      Bucket: bucket,
      Key: fileKey,
      MultipartUpload: multipartMap,
      UploadId: multipart.UploadId,
      ChecksumSHA256: getChecksumFromParts(filePath) // TEST: Replace here with a randomn string to test incorrect checksum of file
    };

    console.log("Completing upload...");
    completeMultipartUpload(s3, doneParams);
  });
}

function getChecksumFromParts() {
    var sum = crypto.createHash('sha256');
    for (part of multipartMap.Parts) {
      sum.update(Buffer.from(part.ChecksumSHA256, 'base64'));
    }
    return sum.digest('base64')+"-"+multipartMap.Parts.length;
}

function getChecksumForBuffer(buffer) {
    var sum = crypto.createHash('sha256');
    sum.update(buffer);
    return sum.digest('base64');
}

// Multipart
console.log("Creating multipart upload for:", fileKey);
s3.createMultipartUpload(multiPartParams, function(mpErr, multipart){
  if (mpErr) { console.log('Error!', mpErr); return; }
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
        UploadId: multipart.UploadId,
        ChecksumAlgorithm: "SHA256",
        ChecksumSHA256: getChecksumForBuffer(body) // TEST: Replace here with a randomn string to test incorrect checksum of part
    };

    // Send a single part
    console.log('Uploading part: #', partParams.PartNumber, ', Range start:', rangeStart);
    uploadPart(s3, multipart, partParams);
  }
});