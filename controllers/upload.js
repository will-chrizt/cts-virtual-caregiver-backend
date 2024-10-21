const config = require("../utils/config");
const uploadRouter = require("express").Router();
const multer = require("multer");
const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const multerS3 = require("multer-s3");

const s3 = new S3Client({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
});

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: config.S3_BUCKET,
    acl: "private",
    key: (request, file, cb) => {
      const timestamp = new Date().getTime();
      const filename = `${timestamp}-${file.originalname}`;

      // if (!request.user) {
      //   return cb(new Error("User not authenticated"));
      // }
      if (!request.body.email) {
        return cb(new Error("Email not provided"));
      }
      cb(null, `${request.body.email}/${filename}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});

uploadRouter.get("/", async (request, response) => {
  const email = request.query.email;
  if (!email) {
    return response.status(400).json({ error: "Email not provided" });
  }

  const params = {
    Bucket: config.S3_BUCKET,
    Prefix: email,
  };

  try {
    const data = await s3.send(new ListObjectsV2Command(params));
    if (!data.Contents) {
      return response.status(404).json({ error: "No files found" });
    }
    const files = data.Contents.map((file) => {
      return {
        key: file.Key,
        url: `${config.S3_URL}/${file.Key}`,
      };
    });

    response.status(200).send(files);
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

uploadRouter.post("/", upload.single("document"), (request, response) => {
  if (!request.file) {
    return response.status(400).json({ error: "No file uploaded" });
  }

  response.status(200).send({
    message: "File uploaded",
    file: request.file.key,
    url: request.file.location,
  });
});

module.exports = uploadRouter;
