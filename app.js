const express = require("express");
const app = express();
const identifyRoute = require("./routes/identify");
require("dotenv").config();

app.use(express.json());
app.use("/identify", identifyRoute);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
