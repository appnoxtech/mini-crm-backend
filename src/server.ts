import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import router from "./routes";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use(router);

const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://192.168.1.6:${port}`);
});


