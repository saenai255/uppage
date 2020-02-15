#!/usr/bin/env node
const { S3 } = require('aws-sdk');
const S3Client = require('@auth0/s3');
const minimist = require('minimist');
const path = require('path');

const options = minimist(process.argv.slice(2), {
    string: ['name', 'secret-key', 'access-key', 'region', 'path'],
    boolean: ['help', 'destroy'],
    default: {
        'access-key': process.env.AWS_ACCESS_KEY_ID,
        'secret-key': process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'eu-central-1',
        path: '.',
        help: false,
        name: null,
        destroy: false
    }
});

options.path = path.resolve(options.path);

if (!options['name'] || !options['access-key'] || !options['secret-key'] || options['help']) {
    console.log('### UpPage Manual ###\n');
    console.log(
        'Usage:\n\t$ npx uppage --name <string> --access-key <string> --secret-key <string>'
    );
    console.log('Description:');
    console.log(
        '\tUploads your current working directory to Amazon S3 and hosts it as a public website.'
    );
    console.log('Options:');
    console.log('\t--name <string> \tPrefix for your uppage bucket. Must be unique.');
    console.log(
        '\t--access-key <string>\tAWS IAM access key id. Defaults to environment variable AWS_ACCESS_KEY_ID.'
    );
    console.log(
        '\t--secret-key <string>\tAWS IAM secret key. Defaults to environment variable AWS_SECRET_ACCESS_KEY.'
    );
    console.log(
        '\t--region <string>\tAWS region in which to create the bucket. Defaults to environment variable AWS_REGION or "eu-central-1".'
    );
    console.log('\t--path <string>\t\tDirectory to upload. Defaults to current working directory.');
    console.log('\t--destroy  \t\tDestroys the current bucket.');
    console.log('\t--help  \t\tShows you this menu.');

    process.exit(0);
}

const AWS_ACCESS_KEY_ID = options['access-key'];
const AWS_SECRET_ACCESS_KEY = options['secret-key'];
const AWS_REGION = options['region'];
const BUCKET_NAME = options['name'] + '.uppage.com';
const WORK_DIR = options['path'];

const s3 = new S3({
    region: AWS_REGION,
    credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY }
});

const client = S3Client.createClient({ s3Client: s3 });

async function bucketExists(name) {
    const buckets = await s3
        .listBuckets()
        .promise()
        .catch(() => {
            throw new Error('Could not search for existing websites.');
        });
    return !!buckets.Buckets.find(bucket => bucket.Name === name);
}

async function deleteBucket(name) {
    await s3.deleteBucket({ Bucket: name }).promise();
}

async function createBucket(name) {
    await s3
        .createBucket({
            Bucket: name,
            CreateBucketConfiguration: {
                LocationConstraint: AWS_REGION
            }
        })
        .promise()
        .catch(() => {
            throw new Error('Could not create a new website bucket.');
        });

    await s3
        .putBucketPolicy({
            Bucket: name,
            Policy: `
        {
            "Version": "2008-10-17",
            "Statement": [
                {
                    "Sid": "PublicReadGetObject",
                    "Effect": "Allow",
                    "Principal": {
                        "AWS": "*"
                    },
                    "Action": "s3:GetObject",
                    "Resource": [
                        "arn:aws:s3:::${name}/**",
                        "arn:aws:s3:::${name}/*",
                        "arn:aws:s3:::${name}"
                    ]
                }
            ]
        }
        `.trim()
        })
        .promise();

    await s3
        .putBucketWebsite({
            Bucket: name,
            WebsiteConfiguration: {
                IndexDocument: {
                    Suffix: 'index.html'
                },
                ErrorDocument: {
                    Key: 'error.html'
                }
            }
        })
        .promise();
}

function uploadFiles(name, path) {
    const uploader = client.uploadDir({
        localDir: path,
        deleteRemoved: true,
        s3Params: { Bucket: name }
    });

    process.stdout.write('Uploading files..');

    return new Promise((resolve, reject) => {
        let lastUploadProgress = -1;

        uploader.on('error', () => reject('Could not upload directory.'));
        uploader.on('progress', () => {
            const uploadProgress = Math.round(uploader.progressMd5Amount / 1024);
            if (uploadProgress === lastUploadProgress) {
                process.stdout.write('.');
                return;
            }

            lastUploadProgress = uploadProgress;
            process.stdout.write(`${uploadProgress}KB`);
        });
        uploader.on('end', () => {
            process.stdout.write('DONE!\n');
            resolve();
        });
    });
}

(async () => {
    const exists = await bucketExists(BUCKET_NAME);

    if (options.destroy) {
        if (!exists) {
            console.log(`Bucket ${BUCKET_NAME} does not exist. Skipping deletion.`);
            return;
        }

        await deleteBucket(BUCKET_NAME);
        console.log(`Bucket ${BUCKET_NAME} successfully deleted.`);
        return;
    }

    if (!exists) {
        console.log(`Bucket ${BUCKET_NAME} does not exist. Creating a new one.`);
        await createBucket(BUCKET_NAME);
    } else {
        console.log(`Bucket ${BUCKET_NAME} already exists. Skipping creation.`);
    }

    await uploadFiles(BUCKET_NAME, WORK_DIR);
    console.log(`UpPage: http://${BUCKET_NAME}.s3-website.${AWS_REGION}.amazonaws.com`);
})();
