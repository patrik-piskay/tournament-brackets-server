require('babel-core/register');

/*eslint-disable*/
var colors = require('mocha/lib/reporters/base').colors;
colors['pass'] = '92';
colors['light'] = '92';
colors['error stack'] = '92';
/*eslint-enable*/

require('./testMatchGenerator.js');
require('./testDatabase.js');