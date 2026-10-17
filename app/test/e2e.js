// Moved in v0.9 (WS-0): the 83 local-mode checks live in test/e2e/legacy-local.js and run against the built file.
// Kept so `node app/test/e2e.js` still works. See test/run.js (npm run test:e2e).
require('../../test/e2e/legacy-local.js');
