function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var HtmlWebpackPlugin = _interopDefault(require('html-webpack-plugin'));
var jsdom = require('jsdom');
var _eval = _interopDefault(require('eval'));
var chalk = _interopDefault(require('chalk'));
var cheerio = _interopDefault(require('cheerio'));
var createElement = _interopDefault(require('create-html-element'));
var fetch = _interopDefault(require('node-fetch'));
var jsesc = _interopDefault(require('jsesc'));
var validateOptions = _interopDefault(require('schema-utils'));

// A type of promise-like that resolves synchronously and supports only one observer
const _Pact = /*#__PURE__*/(function() {
	function _Pact() {}
	_Pact.prototype.then = function(onFulfilled, onRejected) {
		const result = new _Pact();
		const state = this.s;
		if (state) {
			const callback = state & 1 ? onFulfilled : onRejected;
			if (callback) {
				try {
					_settle(result, 1, callback(this.v));
				} catch (e) {
					_settle(result, 2, e);
				}
				return result;
			} else {
				return this;
			}
		}
		this.o = function(_this) {
			try {
				const value = _this.v;
				if (_this.s & 1) {
					_settle(result, 1, onFulfilled ? onFulfilled(value) : value);
				} else if (onRejected) {
					_settle(result, 1, onRejected(value));
				} else {
					_settle(result, 2, value);
				}
			} catch (e) {
				_settle(result, 2, e);
			}
		};
		return result;
	};
	return _Pact;
})();

// Settles a pact synchronously
function _settle(pact, state, value) {
	if (!pact.s) {
		if (value instanceof _Pact) {
			if (value.s) {
				if (state & 1) {
					state = value.s;
				}
				value = value.v;
			} else {
				value.o = _settle.bind(null, pact, state);
				return;
			}
		}
		if (value && value.then) {
			value.then(_settle.bind(null, pact, state), _settle.bind(null, pact, 2));
			return;
		}
		pact.s = state;
		pact.v = value;
		const observer = pact.o;
		if (observer) {
			observer(pact);
		}
	}
}

function _isSettledPact(thenable) {
	return thenable instanceof _Pact && thenable.s & 1;
}

// Asynchronously iterate through an object that has a length property, passing the index as the first argument to the callback (even as the length property changes)
function _forTo(array, body, check) {
	var i = -1, pact, reject;
	function _cycle(result) {
		try {
			while (++i < array.length && (!check || !check())) {
				result = body(i);
				if (result && result.then) {
					if (_isSettledPact(result)) {
						result = result.v;
					} else {
						result.then(_cycle, reject || (reject = _settle.bind(null, pact = new _Pact(), 2)));
						return;
					}
				}
			}
			if (pact) {
				_settle(pact, 1, result);
			} else {
				pact = result;
			}
		} catch (e) {
			_settle(pact || (pact = new _Pact()), 2, e);
		}
	}
	_cycle();
	return pact;
}

// Asynchronously iterate through an object's properties (including properties inherited from the prototype)
// Uses a snapshot of the object's properties
function _forIn(target, body, check) {
	var keys = [];
	for (var key in target) {
		keys.push(key);
	}
	return _forTo(keys, function(i) { return body(keys[i]); }, check);
}

const _iteratorSymbol = /*#__PURE__*/ typeof Symbol !== "undefined" ? (Symbol.iterator || (Symbol.iterator = Symbol("Symbol.iterator"))) : "@@iterator";

const _asyncIteratorSymbol = /*#__PURE__*/ typeof Symbol !== "undefined" ? (Symbol.asyncIterator || (Symbol.asyncIterator = Symbol("Symbol.asyncIterator"))) : "@@asyncIterator";

// Asynchronously call a function and send errors to recovery continuation
function _catch(body, recover) {
	try {
		var result = body();
	} catch(e) {
		return recover(e);
	}
	if (result && result.then) {
		return result.then(void 0, recover);
	}
	return result;
}

var optionsSchema = {
  oneOf: [// {
  //   'index.html': {
  //     'main': '#mything',
  //     'app': {
  //       selector: '#myApp',
  //       scope: { ... },
  //     }
  //   }
  // } ...
  {
    type: 'object',
    propertyNames: {
      pattern: '\.html$' // eslint-disable-line no-useless-escape

    },
    patternProperties: {
      '.*': {
        type: 'object',
        patternProperties: {
          '.*': {
            oneOf: [{
              type: 'string'
            }, {
              type: 'object',
              properties: {
                selector: {
                  type: 'string'
                },
                scope: {
                  type: 'object'
                },
                props: {
                  type: 'object'
                },
                injectPropsTo: {
                  type: 'string',
                  pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$'
                }
              },
              required: ['selector']
            }]
          }
        },
        minProperties: 1
      }
    },
    minProperties: 1
  }, // {
  //   'main': 'myThing'
  // }
  //
  // or...
  //
  // {
  //    main: {
  //      selector: '#mySelector',
  //      scope: { ... }
  //    }
  // }
  {
    type: 'object',
    patternProperties: {
      '.*': {
        oneOf: [{
          type: 'string'
        }, {
          type: 'object',
          properties: {
            selector: {
              type: 'string'
            },
            scope: {
              type: 'object'
            },
            props: {
              type: 'object'
            },
            injectPropsTo: {
              type: 'string',
              pattern: '^[a-zA-Z_][a-zA-Z0-9_]*$'
            }
          },
          required: ['selector']
        }]
      }
    },
    minProperties: 1
  }]
};

var pluginName = 'HtmlWebpackPrerenderPlugin';
var errorLabel = pluginName + " " + (chalk.red('ERROR:'));
var warnLabel = pluginName + " " + (chalk.yellow('Warning:'));

var HtmlWebpackPrerenderPlugin = function HtmlWebpackPrerenderPlugin(options) {
  if ( options === void 0 ) options = {};

  validateOptions(optionsSchema, options, pluginName);
  this.options = this.areShallowOptions(options) ? {
    'index.html': options
  } : options;
};

HtmlWebpackPrerenderPlugin.prototype.areShallowOptions = function areShallowOptions (options) {
  var testKey = Object.keys(options)[0];
  return typeof options[testKey] === 'string' || options[testKey].selector;
};

HtmlWebpackPrerenderPlugin.prototype.findAsset = function findAsset (entry, compilation) {
  var webpackStats = compilation.getStats();
  var webpackStatsJson = webpackStats.toJson();
  var outputFile = webpackStatsJson.assetsByChunkName[entry];
  if (!outputFile) { return null; } // Webpack outputs an array for each chunk when using sourcemaps

  if (outputFile instanceof Array) {
    // Is the main bundle always the first element?
    outputFile = outputFile.find(function (filename) {
      return /\.js$/.test(filename);
    });
  }

  if (!/\.js$/.test(outputFile)) { return null; }
  return compilation.assets[outputFile];
};

HtmlWebpackPrerenderPlugin.prototype.generateScriptForProps = function generateScriptForProps (props, injectPropsTo) {
  return createElement({
    name: 'script',
    attributes: {
      type: 'application/javascript'
    },
    html: ("window." + injectPropsTo + " = " + (jsesc(props, {
      isScriptContext: true
    })) + ";")
  });
};

HtmlWebpackPrerenderPlugin.prototype.injectApp = function injectApp (entry, context, html, compilation) {
  try {

    var _this = this;

    function _temp2(_result) {

      if (Array.isArray(rendered)) {
        markup = rendered[0];
        head = rendered[1];
      } else {
        markup = rendered;
      }

      var $ = cheerio.load(html);

      if ($(selector).length < 1) {
        throw new Error((errorLabel + " Can't find element with query selector: '" + selector + "'."));
      }

      if ($(selector).length > 1) {
        console.warn((warnLabel + " More than one element with query selector: '" + selector + "'."));
      }

      $(selector).html(''); // Blow away any markup in container

      $(selector).append(markup);
      if (head) { $('head').append(head); }

      if (injectPropsTo) {
        $('body').prepend(_this.generateScriptForProps(props, injectPropsTo));
      }

      return $.html();
    }

    var selector = context.selector;
      var scope = context.scope;
      var props = context.props;
      var injectPropsTo = context.injectPropsTo;

    var asset = _this.findAsset(entry, compilation);

    if (!asset) { return Promise.resolve(html); }
    var source = asset.source();
    var app, rendered, markup, head;
    var dom = new jsdom.JSDOM(html, {
      pretendToBeVisual: true
    });
    var window = dom.window;
    var document = window.document;

    var requestAnimationFrame = function (callback) { return setTimeout(callback, 0); };

    var cancelAnimationFrame = function (id) { return clearTimeout(id); };

    window.requestAnimationFrame = requestAnimationFrame;
    window.cancelAnimationFrame = cancelAnimationFrame;
    window.fetch = fetch;
    window.__HTML_WEBPACK_PRERENDER_PLUGIN__ = true;

    try {
      app = _eval(source, Object.assign({}, {window: window,
        document: document,
        fetch: fetch,
        requestAnimationFrame: requestAnimationFrame,
        cancelAnimationFrame: cancelAnimationFrame},
        scope), true);
    } catch (e) {
      throw new Error((errorLabel + " Error evaluating your app script.\n" + e));
    }

    var _temp = _catch(function () {
      return Promise.resolve(app.default(props)).then(function (_app$default) {
        rendered = _app$default;
      });
    }, function (e) {
      throw new Error((errorLabel + " Error rendering component.\n" + e));
    });

    return Promise.resolve(_temp && _temp.then ? _temp.then(_temp2) : _temp2(_temp));
  } catch (e) {
    return Promise.reject(e);
  }
};

HtmlWebpackPrerenderPlugin.prototype.getContext = function getContext (option) {
  if (typeof option === 'string') {
    return {
      selector: option,
      scope: {},
      props: {},
      injectPropsTo: false
    };
  } else {
    return {
      selector: option.selector,
      scope: option.scope || {},
      props: option.props || {},
      injectPropsTo: option.injectPropsTo || false
    };
  }
};

HtmlWebpackPrerenderPlugin.prototype.apply = function apply (compiler) {
    var this$1 = this;

  compiler.hooks.compilation.tap(pluginName, function (compilation) {
    var _this2 = this$1;

    HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync(pluginName, function (data, cb) {
      try {
        function _temp5() {
          data.html = html;
          cb(null, data);
        }

        var outputName = data.outputName || data.plugin.childCompilationOutputName;
        if (!(outputName in _this2.options)) { cb(null, data); }
        var entryMap = _this2.options[outputName];
        var html = data.html;

        var _temp4 = _forIn(entryMap, function (entry) {
          var context = _this2.getContext(entryMap[entry]);

          var _temp3 = _catch(function () {
            return Promise.resolve(_this2.injectApp(entry, context, html, compilation)).then(function (_this2$injectApp) {
              html = _this2$injectApp;
            });
          }, function (e) {
            cb(e, data);
          });

          if (_temp3 && _temp3.then) { return _temp3.then(function () {}); }
        });

        return Promise.resolve(_temp4 && _temp4.then ? _temp4.then(_temp5) : _temp5(_temp4));
      } catch (e) {
        return Promise.reject(e);
      }
    });
  });
};

module.exports = HtmlWebpackPrerenderPlugin;
//# sourceMappingURL=index.js.map
