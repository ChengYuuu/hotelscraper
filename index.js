const fs = require('fs');
const agoda = require('./agoda');

(async () => {
  if (!agoda.areDatesValid("18", "9", "2020", "25", "10", "2021")) {
    return
  }
  await agoda.initialize();
  await agoda.page.waitFor(1000);
  const result = await agoda.search("Lampang", "18", "9", "2020", "25", "10", "2020");
  fs.writeFile('result.json', JSON.stringify(result), (err) => {
    if (err) throw err;
    console.log(result);
  });
})();
