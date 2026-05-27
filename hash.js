const bcrypt = require("bcryptjs");

//const bcrypt = require("bcryptjs");

(async () => {
  const hash = await bcrypt.hash("Admin@123", 12);
  console.log(hash);
})();
