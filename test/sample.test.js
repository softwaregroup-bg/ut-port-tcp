const tap = require('tap');

tap.test('Test', async function(t) {
    t.test('Test', async function(assert) {
        assert.same(true, true);
    });
});
