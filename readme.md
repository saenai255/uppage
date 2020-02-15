### UpPage Manual

##### Usage:

`$ npx uppage --name <string> --access-key <string> --secret-key <string>`

##### Description:

Uploads your current working directory to Amazon S3 and hosts it as a public website.

##### Options:

-   `--name <string>` Prefix for your uppage bucket. Must be unique.
-   `--access-key <string>` AWS IAM access key id. Defaults to environment variable `AWS_ACCESS_KEY_ID`.
-   `--secret-key <string>` AWS IAM secret key. Defaults to environment variable `AWS_SECRET_ACCESS_KEY`.
-   `--region <string>` AWS region in which to create the bucket. Defaults to environment variable `AWS_REGION` or `"eu-central-1"`.
-   `--path <string>` Directory to upload. Defaults to current working directory.
-   `--destroy` Destroys the current bucket.
-   `--help` Shows you this menu.
