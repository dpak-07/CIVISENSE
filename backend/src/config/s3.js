const { S3Client } = require('@aws-sdk/client-s3');
const env = require('./env');

const s3ClientConfig = {
  region: env.aws.region,
  credentials: {
    accessKeyId: env.aws.accessKeyId,
    secretAccessKey: env.aws.secretAccessKey
  },
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED'
};

if (env.aws.endpointUrl) {
  s3ClientConfig.endpoint = env.aws.endpointUrl;
}

const s3Client = new S3Client(s3ClientConfig);

module.exports = s3Client;
