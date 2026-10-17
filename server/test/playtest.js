// Moved in v0.9 (WS-0): the 92 server checks live in test/e2e/legacy-server.js and run against the built file.
// Kept so `node server/test/playtest.js` still works. See test/run.js (npm run test:e2e).
require('../../test/e2e/legacy-server.js');
