const { DeleteObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const env = require('../config/env');

let s3Client = null;
if (env.s3Enabled) {
  s3Client = new S3Client({
    region: env.s3Region,
    endpoint: env.s3Endpoint,
    credentials: {
      accessKeyId: env.s3AccessKeyId,
      secretAccessKey: env.s3SecretAccessKey,
    },
  });
}

const deleteAsset = async (storageKey) => {
  if (!storageKey) return { deleted: false, reason: 'no-storage-key' };
  if (!s3Client) return { deleted: false, reason: 's3-not-configured' };
  await s3Client.send(new DeleteObjectCommand({ Bucket: env.s3Bucket, Key: storageKey }));
  return { deleted: true };
};

module.exports = { deleteAsset };
