'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.default = function (buffers) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var parser = new ParserInstance(buffers, options);
  var response = {};

  response.tag = parser.getTag();
  parser.getSpace();
  response.command = parser.getCommand();

  if (['UID', 'AUTHENTICATE'].indexOf((response.command || '').toUpperCase()) >= 0) {
    parser.getSpace();
    response.command += ' ' + parser.getElement((0, _formalSyntax.COMMAND)());
  }

  if (!isEmpty(parser.remainder)) {
    parser.getSpace();
    response.attributes = parser.getAttributes();
  }

  if (parser.humanReadable) {
    response.attributes = (response.attributes || []).concat({
      type: 'TEXT',
      value: parser.humanReadable
    });
  }

  return response;
};

var _formalSyntax = require('./formal-syntax');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ASCII_NL = 10;
var ASCII_CR = 13;
var ASCII_SPACE = 32;
var ASCII_LEFT_BRACKET = 91;
var ASCII_RIGHT_BRACKET = 93;

function fromCharCode(uint8Array) {
  var batchSize = 10240;
  var strings = [];

  for (var i = 0; i < uint8Array.length; i += batchSize) {
    var begin = i;
    var end = Math.min(i + batchSize, uint8Array.length);
    strings.push(String.fromCharCode.apply(null, uint8Array.subarray(begin, end)));
  }

  return strings.join('');
}

function fromCharCodeTrimmed(uint8Array) {
  var begin = 0;
  var end = uint8Array.length;

  while (uint8Array[begin] === ASCII_SPACE) {
    begin++;
  }

  while (uint8Array[end - 1] === ASCII_SPACE) {
    end--;
  }

  if (begin !== 0 || end !== uint8Array.length) {
    uint8Array = uint8Array.subarray(begin, end);
  }

  return fromCharCode(uint8Array);
}

function isEmpty(uint8Array) {
  for (var i = 0; i < uint8Array.length; i++) {
    if (uint8Array[i] !== ASCII_SPACE) {
      return false;
    }
  }

  return true;
}

var ParserInstance = function () {
  function ParserInstance(input, options) {
    _classCallCheck(this, ParserInstance);

    this.remainder = new Uint8Array(input || 0);
    this.options = options || {};
    this.pos = 0;
  }

  _createClass(ParserInstance, [{
    key: 'getTag',
    value: function getTag() {
      if (!this.tag) {
        this.tag = this.getElement((0, _formalSyntax.TAG)() + '*+', true);
      }
      return this.tag;
    }
  }, {
    key: 'getCommand',
    value: function getCommand() {
      if (!this.command) {
        this.command = this.getElement((0, _formalSyntax.COMMAND)());
      }

      switch ((this.command || '').toString().toUpperCase()) {
        case 'OK':
        case 'NO':
        case 'BAD':
        case 'PREAUTH':
        case 'BYE':
          var lastRightBracket = this.remainder.lastIndexOf(ASCII_RIGHT_BRACKET);
          if (this.remainder[1] === ASCII_LEFT_BRACKET && lastRightBracket > 1) {
            this.humanReadable = fromCharCodeTrimmed(this.remainder.subarray(lastRightBracket + 1));
            this.remainder = this.remainder.subarray(0, lastRightBracket + 1);
          } else {
            this.humanReadable = fromCharCodeTrimmed(this.remainder);
            this.remainder = new Uint8Array(0);
          }
          break;
      }

      return this.command;
    }
  }, {
    key: 'getElement',
    value: function getElement(syntax) {
      var element = void 0;
      if (this.remainder[0] === ASCII_SPACE) {
        throw new Error('Unexpected whitespace at position ' + this.pos);
      }

      var firstSpace = this.remainder.indexOf(ASCII_SPACE);
      if (this.remainder.length > 0 && firstSpace !== 0) {
        if (firstSpace === -1) {
          element = fromCharCode(this.remainder);
        } else {
          element = fromCharCode(this.remainder.subarray(0, firstSpace));
        }

        var errPos = (0, _formalSyntax.verify)(element, syntax);
        if (errPos >= 0) {
          throw new Error('Unexpected char at position ' + (this.pos + errPos));
        }
      } else {
        throw new Error('Unexpected end of input at position ' + this.pos);
      }

      this.pos += element.length;
      this.remainder = this.remainder.subarray(element.length);

      return element;
    }
  }, {
    key: 'getSpace',
    value: function getSpace() {
      if (!this.remainder.length) {
        throw new Error('Unexpected end of input at position ' + this.pos);
      }

      if ((0, _formalSyntax.verify)(String.fromCharCode(this.remainder[0]), (0, _formalSyntax.SP)()) >= 0) {
        throw new Error('Unexpected char at position ' + this.pos);
      }

      this.pos++;
      this.remainder = this.remainder.subarray(1);
    }
  }, {
    key: 'getAttributes',
    value: function getAttributes() {
      if (!this.remainder.length) {
        throw new Error('Unexpected end of input at position ' + this.pos);
      }

      if (this.remainder[0] === ASCII_SPACE) {
        throw new Error('Unexpected whitespace at position ' + this.pos);
      }

      return new TokenParser(this, this.pos, this.remainder.subarray(), this.options).getAttributes();
    }
  }]);

  return ParserInstance;
}();

var Node = function () {
  function Node(uint8Array, parentNode, startPos) {
    _classCallCheck(this, Node);

    this.uint8Array = uint8Array;
    this.childNodes = [];
    this.type = false;
    this.closed = true;
    this.valueSkip = [];
    this.startPos = startPos;
    this.valueStart = this.valueEnd = typeof startPos === 'number' ? startPos + 1 : 0;

    if (parentNode) {
      this.parentNode = parentNode;
      parentNode.childNodes.push(this);
    }
  }

  _createClass(Node, [{
    key: 'getValue',
    value: function getValue() {
      var value = fromCharCode(this.getValueArray());
      return this.valueToUpperCase ? value.toUpperCase() : value;
    }
  }, {
    key: 'getValueLength',
    value: function getValueLength() {
      return this.valueEnd - this.valueStart - this.valueSkip.length;
    }
  }, {
    key: 'getValueArray',
    value: function getValueArray() {
      var valueArray = this.uint8Array.subarray(this.valueStart, this.valueEnd);

      if (this.valueSkip.length === 0) {
        return valueArray;
      }

      var filteredArray = new Uint8Array(valueArray.length - this.valueSkip.length);
      var begin = 0;
      var offset = 0;
      var skip = this.valueSkip.slice();

      skip.push(valueArray.length);

      skip.forEach(function (end) {
        if (end > begin) {
          var subArray = valueArray.subarray(begin, end);
          filteredArray.set(subArray, offset);
          offset += subArray.length;
        }
        begin = end + 1;
      });

      return filteredArray;
    }
  }, {
    key: 'equals',
    value: function equals(value, caseSensitive) {
      if (this.getValueLength() !== value.length) {
        return false;
      }

      return this.equalsAt(value, 0, caseSensitive);
    }
  }, {
    key: 'equalsAt',
    value: function equalsAt(value, index, caseSensitive) {
      caseSensitive = typeof caseSensitive === 'boolean' ? caseSensitive : true;

      if (index < 0) {
        index = this.valueEnd + index;

        while (this.valueSkip.indexOf(this.valueStart + index) >= 0) {
          index--;
        }
      } else {
        index = this.valueStart + index;
      }

      for (var i = 0; i < value.length; i++) {
        while (this.valueSkip.indexOf(index - this.valueStart) >= 0) {
          index++;
        }

        if (index >= this.valueEnd) {
          return false;
        }

        var uint8Char = String.fromCharCode(this.uint8Array[index]);
        var char = value[i];

        if (!caseSensitive) {
          uint8Char = uint8Char.toUpperCase();
          char = char.toUpperCase();
        }

        if (uint8Char !== char) {
          return false;
        }

        index++;
      }

      return true;
    }
  }, {
    key: 'isNumber',
    value: function isNumber() {
      for (var i = 0; i < this.valueEnd - this.valueStart; i++) {
        if (this.valueSkip.indexOf(i) >= 0) {
          continue;
        }

        if (!this.isDigit(i)) {
          return false;
        }
      }

      return true;
    }
  }, {
    key: 'isDigit',
    value: function isDigit(index) {
      if (index < 0) {
        index = this.valueEnd + index;

        while (this.valueSkip.indexOf(this.valueStart + index) >= 0) {
          index--;
        }
      } else {
        index = this.valueStart + index;

        while (this.valueSkip.indexOf(this.valueStart + index) >= 0) {
          index++;
        }
      }

      var ascii = this.uint8Array[index];
      return ascii >= 48 && ascii <= 57;
    }
  }, {
    key: 'containsChar',
    value: function containsChar(char) {
      var ascii = char.charCodeAt(0);

      for (var i = this.valueStart; i < this.valueEnd; i++) {
        if (this.valueSkip.indexOf(i - this.valueStart) >= 0) {
          continue;
        }

        if (this.uint8Array[i] === ascii) {
          return true;
        }
      }

      return false;
    }
  }]);

  return Node;
}();

var TokenParser = function () {
  function TokenParser(parent, startPos, uint8Array) {
    var options = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : {};

    _classCallCheck(this, TokenParser);

    this.uint8Array = uint8Array;
    this.options = options;
    this.parent = parent;

    this.tree = this.currentNode = this.createNode();
    this.pos = startPos || 0;

    this.currentNode.type = 'TREE';

    this.state = 'NORMAL';

    if (this.options.valueAsString === undefined) {
      this.options.valueAsString = true;
    }

    this.processString();
  }

  _createClass(TokenParser, [{
    key: 'getAttributes',
    value: function getAttributes() {
      var _this = this;

      var attributes = [];
      var branch = attributes;

      var walk = function walk(node) {
        var elm = void 0;
        var curBranch = branch;
        var partial = void 0;

        if (!node.closed && node.type === 'SEQUENCE' && node.equals('*')) {
          node.closed = true;
          node.type = 'ATOM';
        }

        // If the node was never closed, throw it
        if (!node.closed) {
          throw new Error('Unexpected end of input at position ' + (_this.pos + _this.uint8Array.length - 1));
        }

        switch (node.type.toUpperCase()) {
          case 'LITERAL':
          case 'STRING':
            elm = {
              type: node.type.toUpperCase(),
              value: _this.options.valueAsString ? node.getValue() : node.getValueArray()
            };
            branch.push(elm);
            break;
          case 'SEQUENCE':
            elm = {
              type: node.type.toUpperCase(),
              value: node.getValue()
            };
            branch.push(elm);
            break;
          case 'ATOM':
            if (node.equals('NIL', true)) {
              branch.push(null);
              break;
            }
            elm = {
              type: node.type.toUpperCase(),
              value: node.getValue()
            };
            branch.push(elm);
            break;
          case 'SECTION':
            branch = branch[branch.length - 1].section = [];
            break;
          case 'LIST':
            elm = [];
            branch.push(elm);
            branch = elm;
            break;
          case 'PARTIAL':
            partial = node.getValue().split('.').map(Number);
            branch[branch.length - 1].partial = partial;
            break;
        }

        node.childNodes.forEach(function (childNode) {
          walk(childNode);
        });
        branch = curBranch;
      };

      walk(this.tree);

      return attributes;
    }
  }, {
    key: 'createNode',
    value: function createNode(parentNode, startPos) {
      return new Node(this.uint8Array, parentNode, startPos);
    }
  }, {
    key: 'processString',
    value: function processString() {
      var _this2 = this;

      var i = void 0;
      var len = void 0;
      var checkSP = function checkSP(pos) {
        // jump to the next non whitespace pos
        while (_this2.uint8Array[i + 1] === ' ') {
          i++;
        }
      };

      for (i = 0, len = this.uint8Array.length; i < len; i++) {
        var chr = String.fromCharCode(this.uint8Array[i]);

        switch (this.state) {
          case 'NORMAL':

            switch (chr) {
              // DQUOTE starts a new string
              case '"':
                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'string';
                this.state = 'STRING';
                this.currentNode.closed = false;
                break;

              // ( starts a new list
              case '(':
                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'LIST';
                this.currentNode.closed = false;
                break;

              // ) closes a list
              case ')':
                if (this.currentNode.type !== 'LIST') {
                  throw new Error('Unexpected list terminator ) at position ' + (this.pos + i));
                }

                this.currentNode.closed = true;
                this.currentNode.endPos = this.pos + i;
                this.currentNode = this.currentNode.parentNode;

                checkSP();
                break;

              // ] closes section group
              case ']':
                if (this.currentNode.type !== 'SECTION') {
                  throw new Error('Unexpected section terminator ] at position ' + (this.pos + i));
                }
                this.currentNode.closed = true;
                this.currentNode.endPos = this.pos + i;
                this.currentNode = this.currentNode.parentNode;
                checkSP();
                break;

              // < starts a new partial
              case '<':
                if (String.fromCharCode(this.uint8Array[i - 1]) !== ']') {
                  this.currentNode = this.createNode(this.currentNode, i);
                  this.currentNode.type = 'ATOM';
                  this.currentNode.valueStart = i;
                  this.currentNode.valueEnd = i + 1;
                  this.state = 'ATOM';
                } else {
                  this.currentNode = this.createNode(this.currentNode, i);
                  this.currentNode.type = 'PARTIAL';
                  this.state = 'PARTIAL';
                  this.currentNode.closed = false;
                }
                break;

              // { starts a new literal
              case '{':
                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'LITERAL';
                this.state = 'LITERAL';
                this.currentNode.closed = false;
                break;

              // ( starts a new sequence
              case '*':
                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'SEQUENCE';
                this.currentNode.valueStart = i;
                this.currentNode.valueEnd = i + 1;
                this.currentNode.closed = false;
                this.state = 'SEQUENCE';
                break;

              // normally a space should never occur
              case ' ':
                // just ignore
                break;

              // [ starts section
              case '[':
                // If it is the *first* element after response command, then process as a response argument list
                if (['OK', 'NO', 'BAD', 'BYE', 'PREAUTH'].indexOf(this.parent.command.toUpperCase()) >= 0 && this.currentNode === this.tree) {
                  this.currentNode.endPos = this.pos + i;

                  this.currentNode = this.createNode(this.currentNode, i);
                  this.currentNode.type = 'ATOM';

                  this.currentNode = this.createNode(this.currentNode, i);
                  this.currentNode.type = 'SECTION';
                  this.currentNode.closed = false;
                  this.state = 'NORMAL';

                  // RFC2221 defines a response code REFERRAL whose payload is an
                  // RFC2192/RFC5092 imapurl that we will try to parse as an ATOM but
                  // fail quite badly at parsing.  Since the imapurl is such a unique
                  // (and crazy) term, we just specialize that case here.
                  if (fromCharCode(this.uint8Array.subarray(i + 1, i + 10)).toUpperCase() === 'REFERRAL ') {
                    // create the REFERRAL atom
                    this.currentNode = this.createNode(this.currentNode, this.pos + i + 1);
                    this.currentNode.type = 'ATOM';
                    this.currentNode.endPos = this.pos + i + 8;
                    this.currentNode.valueStart = i + 1;
                    this.currentNode.valueEnd = i + 9;
                    this.currentNode.valueToUpperCase = true;
                    this.currentNode = this.currentNode.parentNode;

                    // eat all the way through the ] to be the  IMAPURL token.
                    this.currentNode = this.createNode(this.currentNode, this.pos + i + 10);
                    // just call this an ATOM, even though IMAPURL might be more correct
                    this.currentNode.type = 'ATOM';
                    // jump i to the ']'
                    i = this.uint8Array.indexOf(ASCII_RIGHT_BRACKET, i + 10);
                    this.currentNode.endPos = this.pos + i - 1;
                    this.currentNode.valueStart = this.currentNode.startPos - this.pos;
                    this.currentNode.valueEnd = this.currentNode.endPos - this.pos + 1;
                    this.currentNode = this.currentNode.parentNode;

                    // close out the SECTION
                    this.currentNode.closed = true;
                    this.currentNode = this.currentNode.parentNode;
                    checkSP();
                  }

                  break;
                }
              /* falls through */
              default:
                // Any ATOM supported char starts a new Atom sequence, otherwise throw an error
                // Allow \ as the first char for atom to support system flags
                // Allow % to support LIST '' %
                if ((0, _formalSyntax.ATOM_CHAR)().indexOf(chr) < 0 && chr !== '\\' && chr !== '%') {
                  throw new Error('Unexpected char at position ' + (this.pos + i));
                }

                this.currentNode = this.createNode(this.currentNode, i);
                this.currentNode.type = 'ATOM';
                this.currentNode.valueStart = i;
                this.currentNode.valueEnd = i + 1;
                this.state = 'ATOM';
                break;
            }
            break;

          case 'ATOM':

            // space finishes an atom
            if (chr === ' ') {
              this.currentNode.endPos = this.pos + i - 1;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';
              break;
            }

            //
            if (this.currentNode.parentNode && (chr === ')' && this.currentNode.parentNode.type === 'LIST' || chr === ']' && this.currentNode.parentNode.type === 'SECTION')) {
              this.currentNode.endPos = this.pos + i - 1;
              this.currentNode = this.currentNode.parentNode;

              this.currentNode.closed = true;
              this.currentNode.endPos = this.pos + i;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';

              checkSP();
              break;
            }

            if ((chr === ',' || chr === ':') && this.currentNode.isNumber()) {
              this.currentNode.type = 'SEQUENCE';
              this.currentNode.closed = true;
              this.state = 'SEQUENCE';
            }

            // [ starts a section group for this element
            if (chr === '[' && (this.currentNode.equals('BODY', false) || this.currentNode.equals('BODY.PEEK', false))) {
              this.currentNode.endPos = this.pos + i;
              this.currentNode = this.createNode(this.currentNode.parentNode, this.pos + i);
              this.currentNode.type = 'SECTION';
              this.currentNode.closed = false;
              this.state = 'NORMAL';
              break;
            }

            if (chr === '<') {
              throw new Error('Unexpected start of partial at position ' + this.pos);
            }

            // if the char is not ATOM compatible or not quoted, throw. Allow \* as an exception
            if ((0, _formalSyntax.ATOM_CHAR)().indexOf(chr) < 0 && (0, _formalSyntax.DQUOTE)().indexOf(chr) < 0 && chr !== ']' && !(chr === '*' && this.currentNode.equals('\\'))) {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            } else if (this.currentNode.equals('\\*')) {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            }

            this.currentNode.valueEnd = i + 1;
            break;

          case 'STRING':

            // DQUOTE ends the string sequence
            if (chr === '"') {
              this.currentNode.endPos = this.pos + i;
              this.currentNode.closed = true;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';

              checkSP();
              break;
            }

            // \ Escapes the following char
            if (chr === '\\') {
              this.currentNode.valueSkip.push(i - this.currentNode.valueStart);
              i++;
              if (i >= len) {
                throw new Error('Unexpected end of input at position ' + (this.pos + i));
              }
              chr = String.fromCharCode(this.uint8Array[i]);
            }

            /* // skip this check, otherwise the parser might explode on binary input
            if (TEXT_CHAR().indexOf(chr) < 0) {
                throw new Error('Unexpected char at position ' + (this.pos + i));
            }
            */

            this.currentNode.valueEnd = i + 1;
            break;

          case 'PARTIAL':
            if (chr === '>') {
              if (this.currentNode.equalsAt('.', -1)) {
                throw new Error('Unexpected end of partial at position ' + this.pos);
              }
              this.currentNode.endPos = this.pos + i;
              this.currentNode.closed = true;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';
              checkSP();
              break;
            }

            if (chr === '.' && (!this.currentNode.getValueLength() || this.currentNode.containsChar('.'))) {
              throw new Error('Unexpected partial separator . at position ' + this.pos);
            }

            if ((0, _formalSyntax.DIGIT)().indexOf(chr) < 0 && chr !== '.') {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            }

            if (chr !== '.' && (this.currentNode.equals('0') || this.currentNode.equalsAt('.0', -2))) {
              throw new Error('Invalid partial at position ' + (this.pos + i));
            }

            this.currentNode.valueEnd = i + 1;
            break;

          case 'LITERAL':
            if (this.currentNode.started) {
              if (chr === '\0') {
                throw new Error('Unexpected \\x00 at position ' + (this.pos + i));
              }
              this.currentNode.valueEnd = i + 1;

              if (this.currentNode.getValueLength() >= this.currentNode.literalLength) {
                this.currentNode.endPos = this.pos + i;
                this.currentNode.closed = true;
                this.currentNode = this.currentNode.parentNode;
                this.state = 'NORMAL';
                checkSP();
              }
              break;
            }

            if (chr === '+' && this.options.literalPlus) {
              this.currentNode.literalPlus = true;
              break;
            }

            if (chr === '}') {
              if (!('literalLength' in this.currentNode)) {
                throw new Error('Unexpected literal prefix end char } at position ' + (this.pos + i));
              }
              if (this.uint8Array[i + 1] === ASCII_NL) {
                i++;
              } else if (this.uint8Array[i + 1] === ASCII_CR && this.uint8Array[i + 2] === ASCII_NL) {
                i += 2;
              } else {
                throw new Error('Unexpected char at position ' + (this.pos + i));
              }
              this.currentNode.valueStart = i + 1;
              this.currentNode.literalLength = Number(this.currentNode.literalLength);
              this.currentNode.started = true;

              if (!this.currentNode.literalLength) {
                // special case where literal content length is 0
                // close the node right away, do not wait for additional input
                this.currentNode.endPos = this.pos + i;
                this.currentNode.closed = true;
                this.currentNode = this.currentNode.parentNode;
                this.state = 'NORMAL';
                checkSP();
              }
              break;
            }
            if ((0, _formalSyntax.DIGIT)().indexOf(chr) < 0) {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            }
            if (this.currentNode.literalLength === '0') {
              throw new Error('Invalid literal at position ' + (this.pos + i));
            }
            this.currentNode.literalLength = (this.currentNode.literalLength || '') + chr;
            break;

          case 'SEQUENCE':
            // space finishes the sequence set
            if (chr === ' ') {
              if (!this.currentNode.isDigit(-1) && !this.currentNode.equalsAt('*', -1)) {
                throw new Error('Unexpected whitespace at position ' + (this.pos + i));
              }

              if (this.currentNode.equalsAt('*', -1) && !this.currentNode.equalsAt(':', -2)) {
                throw new Error('Unexpected whitespace at position ' + (this.pos + i));
              }

              this.currentNode.closed = true;
              this.currentNode.endPos = this.pos + i - 1;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';
              break;
            } else if (this.currentNode.parentNode && chr === ']' && this.currentNode.parentNode.type === 'SECTION') {
              this.currentNode.endPos = this.pos + i - 1;
              this.currentNode = this.currentNode.parentNode;

              this.currentNode.closed = true;
              this.currentNode.endPos = this.pos + i;
              this.currentNode = this.currentNode.parentNode;
              this.state = 'NORMAL';

              checkSP();
              break;
            }

            if (chr === ':') {
              if (!this.currentNode.isDigit(-1) && !this.currentNode.equalsAt('*', -1)) {
                throw new Error('Unexpected range separator : at position ' + (this.pos + i));
              }
            } else if (chr === '*') {
              if (!this.currentNode.equalsAt(',', -1) && !this.currentNode.equalsAt(':', -1)) {
                throw new Error('Unexpected range wildcard at position ' + (this.pos + i));
              }
            } else if (chr === ',') {
              if (!this.currentNode.isDigit(-1) && !this.currentNode.equalsAt('*', -1)) {
                throw new Error('Unexpected sequence separator , at position ' + (this.pos + i));
              }
              if (this.currentNode.equalsAt('*', -1) && !this.currentNode.equalsAt(':', -2)) {
                throw new Error('Unexpected sequence separator , at position ' + (this.pos + i));
              }
            } else if (!/\d/.test(chr)) {
              throw new Error('Unexpected char at position ' + (this.pos + i));
            }

            if (/\d/.test(chr) && this.currentNode.equalsAt('*', -1)) {
              throw new Error('Unexpected number at position ' + (this.pos + i));
            }

            this.currentNode.valueEnd = i + 1;
            break;
        }
      }
    }
  }]);

  return TokenParser;
}();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9wYXJzZXIuanMiXSwibmFtZXMiOlsiYnVmZmVycyIsIm9wdGlvbnMiLCJwYXJzZXIiLCJQYXJzZXJJbnN0YW5jZSIsInJlc3BvbnNlIiwidGFnIiwiZ2V0VGFnIiwiZ2V0U3BhY2UiLCJjb21tYW5kIiwiZ2V0Q29tbWFuZCIsImluZGV4T2YiLCJ0b1VwcGVyQ2FzZSIsImdldEVsZW1lbnQiLCJpc0VtcHR5IiwicmVtYWluZGVyIiwiYXR0cmlidXRlcyIsImdldEF0dHJpYnV0ZXMiLCJodW1hblJlYWRhYmxlIiwiY29uY2F0IiwidHlwZSIsInZhbHVlIiwiQVNDSUlfTkwiLCJBU0NJSV9DUiIsIkFTQ0lJX1NQQUNFIiwiQVNDSUlfTEVGVF9CUkFDS0VUIiwiQVNDSUlfUklHSFRfQlJBQ0tFVCIsImZyb21DaGFyQ29kZSIsInVpbnQ4QXJyYXkiLCJiYXRjaFNpemUiLCJzdHJpbmdzIiwiaSIsImxlbmd0aCIsImJlZ2luIiwiZW5kIiwiTWF0aCIsIm1pbiIsInB1c2giLCJTdHJpbmciLCJhcHBseSIsInN1YmFycmF5Iiwiam9pbiIsImZyb21DaGFyQ29kZVRyaW1tZWQiLCJpbnB1dCIsIlVpbnQ4QXJyYXkiLCJwb3MiLCJ0b1N0cmluZyIsImxhc3RSaWdodEJyYWNrZXQiLCJsYXN0SW5kZXhPZiIsInN5bnRheCIsImVsZW1lbnQiLCJFcnJvciIsImZpcnN0U3BhY2UiLCJlcnJQb3MiLCJUb2tlblBhcnNlciIsIk5vZGUiLCJwYXJlbnROb2RlIiwic3RhcnRQb3MiLCJjaGlsZE5vZGVzIiwiY2xvc2VkIiwidmFsdWVTa2lwIiwidmFsdWVTdGFydCIsInZhbHVlRW5kIiwiZ2V0VmFsdWVBcnJheSIsInZhbHVlVG9VcHBlckNhc2UiLCJ2YWx1ZUFycmF5IiwiZmlsdGVyZWRBcnJheSIsIm9mZnNldCIsInNraXAiLCJzbGljZSIsImZvckVhY2giLCJzdWJBcnJheSIsInNldCIsImNhc2VTZW5zaXRpdmUiLCJnZXRWYWx1ZUxlbmd0aCIsImVxdWFsc0F0IiwiaW5kZXgiLCJ1aW50OENoYXIiLCJjaGFyIiwiaXNEaWdpdCIsImFzY2lpIiwiY2hhckNvZGVBdCIsInBhcmVudCIsInRyZWUiLCJjdXJyZW50Tm9kZSIsImNyZWF0ZU5vZGUiLCJzdGF0ZSIsInZhbHVlQXNTdHJpbmciLCJ1bmRlZmluZWQiLCJwcm9jZXNzU3RyaW5nIiwiYnJhbmNoIiwid2FsayIsImVsbSIsImN1ckJyYW5jaCIsInBhcnRpYWwiLCJub2RlIiwiZXF1YWxzIiwiZ2V0VmFsdWUiLCJzZWN0aW9uIiwic3BsaXQiLCJtYXAiLCJOdW1iZXIiLCJjaGlsZE5vZGUiLCJsZW4iLCJjaGVja1NQIiwiY2hyIiwiZW5kUG9zIiwiaXNOdW1iZXIiLCJjb250YWluc0NoYXIiLCJzdGFydGVkIiwibGl0ZXJhbExlbmd0aCIsImxpdGVyYWxQbHVzIiwidGVzdCJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7a0JBbXhCZSxVQUFVQSxPQUFWLEVBQWlDO0FBQUEsTUFBZEMsT0FBYyx1RUFBSixFQUFJOztBQUM5QyxNQUFJQyxTQUFTLElBQUlDLGNBQUosQ0FBbUJILE9BQW5CLEVBQTRCQyxPQUE1QixDQUFiO0FBQ0EsTUFBSUcsV0FBVyxFQUFmOztBQUVBQSxXQUFTQyxHQUFULEdBQWVILE9BQU9JLE1BQVAsRUFBZjtBQUNBSixTQUFPSyxRQUFQO0FBQ0FILFdBQVNJLE9BQVQsR0FBbUJOLE9BQU9PLFVBQVAsRUFBbkI7O0FBRUEsTUFBSSxDQUFDLEtBQUQsRUFBUSxjQUFSLEVBQXdCQyxPQUF4QixDQUFnQyxDQUFDTixTQUFTSSxPQUFULElBQW9CLEVBQXJCLEVBQXlCRyxXQUF6QixFQUFoQyxLQUEyRSxDQUEvRSxFQUFrRjtBQUNoRlQsV0FBT0ssUUFBUDtBQUNBSCxhQUFTSSxPQUFULElBQW9CLE1BQU1OLE9BQU9VLFVBQVAsQ0FBa0IsNEJBQWxCLENBQTFCO0FBQ0Q7O0FBRUQsTUFBSSxDQUFDQyxRQUFRWCxPQUFPWSxTQUFmLENBQUwsRUFBZ0M7QUFDOUJaLFdBQU9LLFFBQVA7QUFDQUgsYUFBU1csVUFBVCxHQUFzQmIsT0FBT2MsYUFBUCxFQUF0QjtBQUNEOztBQUVELE1BQUlkLE9BQU9lLGFBQVgsRUFBMEI7QUFDeEJiLGFBQVNXLFVBQVQsR0FBc0IsQ0FBQ1gsU0FBU1csVUFBVCxJQUF1QixFQUF4QixFQUE0QkcsTUFBNUIsQ0FBbUM7QUFDdkRDLFlBQU0sTUFEaUQ7QUFFdkRDLGFBQU9sQixPQUFPZTtBQUZ5QyxLQUFuQyxDQUF0QjtBQUlEOztBQUVELFNBQU9iLFFBQVA7QUFDRCxDOztBQTd5QkQ7Ozs7QUFLQSxJQUFJaUIsV0FBVyxFQUFmO0FBQ0EsSUFBSUMsV0FBVyxFQUFmO0FBQ0EsSUFBSUMsY0FBYyxFQUFsQjtBQUNBLElBQUlDLHFCQUFxQixFQUF6QjtBQUNBLElBQUlDLHNCQUFzQixFQUExQjs7QUFFQSxTQUFTQyxZQUFULENBQXVCQyxVQUF2QixFQUFtQztBQUNqQyxNQUFNQyxZQUFZLEtBQWxCO0FBQ0EsTUFBSUMsVUFBVSxFQUFkOztBQUVBLE9BQUssSUFBSUMsSUFBSSxDQUFiLEVBQWdCQSxJQUFJSCxXQUFXSSxNQUEvQixFQUF1Q0QsS0FBS0YsU0FBNUMsRUFBdUQ7QUFDckQsUUFBTUksUUFBUUYsQ0FBZDtBQUNBLFFBQU1HLE1BQU1DLEtBQUtDLEdBQUwsQ0FBU0wsSUFBSUYsU0FBYixFQUF3QkQsV0FBV0ksTUFBbkMsQ0FBWjtBQUNBRixZQUFRTyxJQUFSLENBQWFDLE9BQU9YLFlBQVAsQ0FBb0JZLEtBQXBCLENBQTBCLElBQTFCLEVBQWdDWCxXQUFXWSxRQUFYLENBQW9CUCxLQUFwQixFQUEyQkMsR0FBM0IsQ0FBaEMsQ0FBYjtBQUNEOztBQUVELFNBQU9KLFFBQVFXLElBQVIsQ0FBYSxFQUFiLENBQVA7QUFDRDs7QUFFRCxTQUFTQyxtQkFBVCxDQUE4QmQsVUFBOUIsRUFBMEM7QUFDeEMsTUFBSUssUUFBUSxDQUFaO0FBQ0EsTUFBSUMsTUFBTU4sV0FBV0ksTUFBckI7O0FBRUEsU0FBT0osV0FBV0ssS0FBWCxNQUFzQlQsV0FBN0IsRUFBMEM7QUFDeENTO0FBQ0Q7O0FBRUQsU0FBT0wsV0FBV00sTUFBTSxDQUFqQixNQUF3QlYsV0FBL0IsRUFBNEM7QUFDMUNVO0FBQ0Q7O0FBRUQsTUFBSUQsVUFBVSxDQUFWLElBQWVDLFFBQVFOLFdBQVdJLE1BQXRDLEVBQThDO0FBQzVDSixpQkFBYUEsV0FBV1ksUUFBWCxDQUFvQlAsS0FBcEIsRUFBMkJDLEdBQTNCLENBQWI7QUFDRDs7QUFFRCxTQUFPUCxhQUFhQyxVQUFiLENBQVA7QUFDRDs7QUFFRCxTQUFTZCxPQUFULENBQWtCYyxVQUFsQixFQUE4QjtBQUM1QixPQUFLLElBQUlHLElBQUksQ0FBYixFQUFnQkEsSUFBSUgsV0FBV0ksTUFBL0IsRUFBdUNELEdBQXZDLEVBQTRDO0FBQzFDLFFBQUlILFdBQVdHLENBQVgsTUFBa0JQLFdBQXRCLEVBQW1DO0FBQ2pDLGFBQU8sS0FBUDtBQUNEO0FBQ0Y7O0FBRUQsU0FBTyxJQUFQO0FBQ0Q7O0lBRUtwQixjO0FBQ0osMEJBQWF1QyxLQUFiLEVBQW9CekMsT0FBcEIsRUFBNkI7QUFBQTs7QUFDM0IsU0FBS2EsU0FBTCxHQUFpQixJQUFJNkIsVUFBSixDQUFlRCxTQUFTLENBQXhCLENBQWpCO0FBQ0EsU0FBS3pDLE9BQUwsR0FBZUEsV0FBVyxFQUExQjtBQUNBLFNBQUsyQyxHQUFMLEdBQVcsQ0FBWDtBQUNEOzs7OzZCQUNTO0FBQ1IsVUFBSSxDQUFDLEtBQUt2QyxHQUFWLEVBQWU7QUFDYixhQUFLQSxHQUFMLEdBQVcsS0FBS08sVUFBTCxDQUFnQiwyQkFBUSxJQUF4QixFQUE4QixJQUE5QixDQUFYO0FBQ0Q7QUFDRCxhQUFPLEtBQUtQLEdBQVo7QUFDRDs7O2lDQUVhO0FBQ1osVUFBSSxDQUFDLEtBQUtHLE9BQVYsRUFBbUI7QUFDakIsYUFBS0EsT0FBTCxHQUFlLEtBQUtJLFVBQUwsQ0FBZ0IsNEJBQWhCLENBQWY7QUFDRDs7QUFFRCxjQUFRLENBQUMsS0FBS0osT0FBTCxJQUFnQixFQUFqQixFQUFxQnFDLFFBQXJCLEdBQWdDbEMsV0FBaEMsRUFBUjtBQUNFLGFBQUssSUFBTDtBQUNBLGFBQUssSUFBTDtBQUNBLGFBQUssS0FBTDtBQUNBLGFBQUssU0FBTDtBQUNBLGFBQUssS0FBTDtBQUNFLGNBQUltQyxtQkFBbUIsS0FBS2hDLFNBQUwsQ0FBZWlDLFdBQWYsQ0FBMkJ0QixtQkFBM0IsQ0FBdkI7QUFDQSxjQUFJLEtBQUtYLFNBQUwsQ0FBZSxDQUFmLE1BQXNCVSxrQkFBdEIsSUFBNENzQixtQkFBbUIsQ0FBbkUsRUFBc0U7QUFDcEUsaUJBQUs3QixhQUFMLEdBQXFCd0Isb0JBQW9CLEtBQUszQixTQUFMLENBQWV5QixRQUFmLENBQXdCTyxtQkFBbUIsQ0FBM0MsQ0FBcEIsQ0FBckI7QUFDQSxpQkFBS2hDLFNBQUwsR0FBaUIsS0FBS0EsU0FBTCxDQUFleUIsUUFBZixDQUF3QixDQUF4QixFQUEyQk8sbUJBQW1CLENBQTlDLENBQWpCO0FBQ0QsV0FIRCxNQUdPO0FBQ0wsaUJBQUs3QixhQUFMLEdBQXFCd0Isb0JBQW9CLEtBQUszQixTQUF6QixDQUFyQjtBQUNBLGlCQUFLQSxTQUFMLEdBQWlCLElBQUk2QixVQUFKLENBQWUsQ0FBZixDQUFqQjtBQUNEO0FBQ0Q7QUFkSjs7QUFpQkEsYUFBTyxLQUFLbkMsT0FBWjtBQUNEOzs7K0JBRVd3QyxNLEVBQVE7QUFDbEIsVUFBSUMsZ0JBQUo7QUFDQSxVQUFJLEtBQUtuQyxTQUFMLENBQWUsQ0FBZixNQUFzQlMsV0FBMUIsRUFBdUM7QUFDckMsY0FBTSxJQUFJMkIsS0FBSixDQUFVLHVDQUF1QyxLQUFLTixHQUF0RCxDQUFOO0FBQ0Q7O0FBRUQsVUFBSU8sYUFBYSxLQUFLckMsU0FBTCxDQUFlSixPQUFmLENBQXVCYSxXQUF2QixDQUFqQjtBQUNBLFVBQUksS0FBS1QsU0FBTCxDQUFlaUIsTUFBZixHQUF3QixDQUF4QixJQUE2Qm9CLGVBQWUsQ0FBaEQsRUFBbUQ7QUFDakQsWUFBSUEsZUFBZSxDQUFDLENBQXBCLEVBQXVCO0FBQ3JCRixvQkFBVXZCLGFBQWEsS0FBS1osU0FBbEIsQ0FBVjtBQUNELFNBRkQsTUFFTztBQUNMbUMsb0JBQVV2QixhQUFhLEtBQUtaLFNBQUwsQ0FBZXlCLFFBQWYsQ0FBd0IsQ0FBeEIsRUFBMkJZLFVBQTNCLENBQWIsQ0FBVjtBQUNEOztBQUVELFlBQU1DLFNBQVMsMEJBQU9ILE9BQVAsRUFBZ0JELE1BQWhCLENBQWY7QUFDQSxZQUFJSSxVQUFVLENBQWQsRUFBaUI7QUFDZixnQkFBTSxJQUFJRixLQUFKLENBQVUsa0NBQWtDLEtBQUtOLEdBQUwsR0FBV1EsTUFBN0MsQ0FBVixDQUFOO0FBQ0Q7QUFDRixPQVhELE1BV087QUFDTCxjQUFNLElBQUlGLEtBQUosQ0FBVSx5Q0FBeUMsS0FBS04sR0FBeEQsQ0FBTjtBQUNEOztBQUVELFdBQUtBLEdBQUwsSUFBWUssUUFBUWxCLE1BQXBCO0FBQ0EsV0FBS2pCLFNBQUwsR0FBaUIsS0FBS0EsU0FBTCxDQUFleUIsUUFBZixDQUF3QlUsUUFBUWxCLE1BQWhDLENBQWpCOztBQUVBLGFBQU9rQixPQUFQO0FBQ0Q7OzsrQkFFVztBQUNWLFVBQUksQ0FBQyxLQUFLbkMsU0FBTCxDQUFlaUIsTUFBcEIsRUFBNEI7QUFDMUIsY0FBTSxJQUFJbUIsS0FBSixDQUFVLHlDQUF5QyxLQUFLTixHQUF4RCxDQUFOO0FBQ0Q7O0FBRUQsVUFBSSwwQkFBT1AsT0FBT1gsWUFBUCxDQUFvQixLQUFLWixTQUFMLENBQWUsQ0FBZixDQUFwQixDQUFQLEVBQStDLHVCQUEvQyxLQUF3RCxDQUE1RCxFQUErRDtBQUM3RCxjQUFNLElBQUlvQyxLQUFKLENBQVUsaUNBQWlDLEtBQUtOLEdBQWhELENBQU47QUFDRDs7QUFFRCxXQUFLQSxHQUFMO0FBQ0EsV0FBSzlCLFNBQUwsR0FBaUIsS0FBS0EsU0FBTCxDQUFleUIsUUFBZixDQUF3QixDQUF4QixDQUFqQjtBQUNEOzs7b0NBRWdCO0FBQ2YsVUFBSSxDQUFDLEtBQUt6QixTQUFMLENBQWVpQixNQUFwQixFQUE0QjtBQUMxQixjQUFNLElBQUltQixLQUFKLENBQVUseUNBQXlDLEtBQUtOLEdBQXhELENBQU47QUFDRDs7QUFFRCxVQUFJLEtBQUs5QixTQUFMLENBQWUsQ0FBZixNQUFzQlMsV0FBMUIsRUFBdUM7QUFDckMsY0FBTSxJQUFJMkIsS0FBSixDQUFVLHVDQUF1QyxLQUFLTixHQUF0RCxDQUFOO0FBQ0Q7O0FBRUQsYUFBTyxJQUFJUyxXQUFKLENBQWdCLElBQWhCLEVBQXNCLEtBQUtULEdBQTNCLEVBQWdDLEtBQUs5QixTQUFMLENBQWV5QixRQUFmLEVBQWhDLEVBQTJELEtBQUt0QyxPQUFoRSxFQUF5RWUsYUFBekUsRUFBUDtBQUNEOzs7Ozs7SUFHR3NDLEk7QUFDSixnQkFBYTNCLFVBQWIsRUFBeUI0QixVQUF6QixFQUFxQ0MsUUFBckMsRUFBK0M7QUFBQTs7QUFDN0MsU0FBSzdCLFVBQUwsR0FBa0JBLFVBQWxCO0FBQ0EsU0FBSzhCLFVBQUwsR0FBa0IsRUFBbEI7QUFDQSxTQUFLdEMsSUFBTCxHQUFZLEtBQVo7QUFDQSxTQUFLdUMsTUFBTCxHQUFjLElBQWQ7QUFDQSxTQUFLQyxTQUFMLEdBQWlCLEVBQWpCO0FBQ0EsU0FBS0gsUUFBTCxHQUFnQkEsUUFBaEI7QUFDQSxTQUFLSSxVQUFMLEdBQWtCLEtBQUtDLFFBQUwsR0FBZ0IsT0FBT0wsUUFBUCxLQUFvQixRQUFwQixHQUErQkEsV0FBVyxDQUExQyxHQUE4QyxDQUFoRjs7QUFFQSxRQUFJRCxVQUFKLEVBQWdCO0FBQ2QsV0FBS0EsVUFBTCxHQUFrQkEsVUFBbEI7QUFDQUEsaUJBQVdFLFVBQVgsQ0FBc0JyQixJQUF0QixDQUEyQixJQUEzQjtBQUNEO0FBQ0Y7Ozs7K0JBRVc7QUFDVixVQUFJaEIsUUFBUU0sYUFBYSxLQUFLb0MsYUFBTCxFQUFiLENBQVo7QUFDQSxhQUFPLEtBQUtDLGdCQUFMLEdBQXdCM0MsTUFBTVQsV0FBTixFQUF4QixHQUE4Q1MsS0FBckQ7QUFDRDs7O3FDQUVpQjtBQUNoQixhQUFPLEtBQUt5QyxRQUFMLEdBQWdCLEtBQUtELFVBQXJCLEdBQWtDLEtBQUtELFNBQUwsQ0FBZTVCLE1BQXhEO0FBQ0Q7OztvQ0FFZ0I7QUFDZixVQUFNaUMsYUFBYSxLQUFLckMsVUFBTCxDQUFnQlksUUFBaEIsQ0FBeUIsS0FBS3FCLFVBQTlCLEVBQTBDLEtBQUtDLFFBQS9DLENBQW5COztBQUVBLFVBQUksS0FBS0YsU0FBTCxDQUFlNUIsTUFBZixLQUEwQixDQUE5QixFQUFpQztBQUMvQixlQUFPaUMsVUFBUDtBQUNEOztBQUVELFVBQUlDLGdCQUFnQixJQUFJdEIsVUFBSixDQUFlcUIsV0FBV2pDLE1BQVgsR0FBb0IsS0FBSzRCLFNBQUwsQ0FBZTVCLE1BQWxELENBQXBCO0FBQ0EsVUFBSUMsUUFBUSxDQUFaO0FBQ0EsVUFBSWtDLFNBQVMsQ0FBYjtBQUNBLFVBQUlDLE9BQU8sS0FBS1IsU0FBTCxDQUFlUyxLQUFmLEVBQVg7O0FBRUFELFdBQUsvQixJQUFMLENBQVU0QixXQUFXakMsTUFBckI7O0FBRUFvQyxXQUFLRSxPQUFMLENBQWEsVUFBVXBDLEdBQVYsRUFBZTtBQUMxQixZQUFJQSxNQUFNRCxLQUFWLEVBQWlCO0FBQ2YsY0FBSXNDLFdBQVdOLFdBQVd6QixRQUFYLENBQW9CUCxLQUFwQixFQUEyQkMsR0FBM0IsQ0FBZjtBQUNBZ0Msd0JBQWNNLEdBQWQsQ0FBa0JELFFBQWxCLEVBQTRCSixNQUE1QjtBQUNBQSxvQkFBVUksU0FBU3ZDLE1BQW5CO0FBQ0Q7QUFDREMsZ0JBQVFDLE1BQU0sQ0FBZDtBQUNELE9BUEQ7O0FBU0EsYUFBT2dDLGFBQVA7QUFDRDs7OzJCQUVPN0MsSyxFQUFPb0QsYSxFQUFlO0FBQzVCLFVBQUksS0FBS0MsY0FBTCxPQUEwQnJELE1BQU1XLE1BQXBDLEVBQTRDO0FBQzFDLGVBQU8sS0FBUDtBQUNEOztBQUVELGFBQU8sS0FBSzJDLFFBQUwsQ0FBY3RELEtBQWQsRUFBcUIsQ0FBckIsRUFBd0JvRCxhQUF4QixDQUFQO0FBQ0Q7Ozs2QkFFU3BELEssRUFBT3VELEssRUFBT0gsYSxFQUFlO0FBQ3JDQSxzQkFBZ0IsT0FBT0EsYUFBUCxLQUF5QixTQUF6QixHQUFxQ0EsYUFBckMsR0FBcUQsSUFBckU7O0FBRUEsVUFBSUcsUUFBUSxDQUFaLEVBQWU7QUFDYkEsZ0JBQVEsS0FBS2QsUUFBTCxHQUFnQmMsS0FBeEI7O0FBRUEsZUFBTyxLQUFLaEIsU0FBTCxDQUFlakQsT0FBZixDQUF1QixLQUFLa0QsVUFBTCxHQUFrQmUsS0FBekMsS0FBbUQsQ0FBMUQsRUFBNkQ7QUFDM0RBO0FBQ0Q7QUFDRixPQU5ELE1BTU87QUFDTEEsZ0JBQVEsS0FBS2YsVUFBTCxHQUFrQmUsS0FBMUI7QUFDRDs7QUFFRCxXQUFLLElBQUk3QyxJQUFJLENBQWIsRUFBZ0JBLElBQUlWLE1BQU1XLE1BQTFCLEVBQWtDRCxHQUFsQyxFQUF1QztBQUNyQyxlQUFPLEtBQUs2QixTQUFMLENBQWVqRCxPQUFmLENBQXVCaUUsUUFBUSxLQUFLZixVQUFwQyxLQUFtRCxDQUExRCxFQUE2RDtBQUMzRGU7QUFDRDs7QUFFRCxZQUFJQSxTQUFTLEtBQUtkLFFBQWxCLEVBQTRCO0FBQzFCLGlCQUFPLEtBQVA7QUFDRDs7QUFFRCxZQUFJZSxZQUFZdkMsT0FBT1gsWUFBUCxDQUFvQixLQUFLQyxVQUFMLENBQWdCZ0QsS0FBaEIsQ0FBcEIsQ0FBaEI7QUFDQSxZQUFJRSxPQUFPekQsTUFBTVUsQ0FBTixDQUFYOztBQUVBLFlBQUksQ0FBQzBDLGFBQUwsRUFBb0I7QUFDbEJJLHNCQUFZQSxVQUFVakUsV0FBVixFQUFaO0FBQ0FrRSxpQkFBT0EsS0FBS2xFLFdBQUwsRUFBUDtBQUNEOztBQUVELFlBQUlpRSxjQUFjQyxJQUFsQixFQUF3QjtBQUN0QixpQkFBTyxLQUFQO0FBQ0Q7O0FBRURGO0FBQ0Q7O0FBRUQsYUFBTyxJQUFQO0FBQ0Q7OzsrQkFFVztBQUNWLFdBQUssSUFBSTdDLElBQUksQ0FBYixFQUFnQkEsSUFBSSxLQUFLK0IsUUFBTCxHQUFnQixLQUFLRCxVQUF6QyxFQUFxRDlCLEdBQXJELEVBQTBEO0FBQ3hELFlBQUksS0FBSzZCLFNBQUwsQ0FBZWpELE9BQWYsQ0FBdUJvQixDQUF2QixLQUE2QixDQUFqQyxFQUFvQztBQUNsQztBQUNEOztBQUVELFlBQUksQ0FBQyxLQUFLZ0QsT0FBTCxDQUFhaEQsQ0FBYixDQUFMLEVBQXNCO0FBQ3BCLGlCQUFPLEtBQVA7QUFDRDtBQUNGOztBQUVELGFBQU8sSUFBUDtBQUNEOzs7NEJBRVE2QyxLLEVBQU87QUFDZCxVQUFJQSxRQUFRLENBQVosRUFBZTtBQUNiQSxnQkFBUSxLQUFLZCxRQUFMLEdBQWdCYyxLQUF4Qjs7QUFFQSxlQUFPLEtBQUtoQixTQUFMLENBQWVqRCxPQUFmLENBQXVCLEtBQUtrRCxVQUFMLEdBQWtCZSxLQUF6QyxLQUFtRCxDQUExRCxFQUE2RDtBQUMzREE7QUFDRDtBQUNGLE9BTkQsTUFNTztBQUNMQSxnQkFBUSxLQUFLZixVQUFMLEdBQWtCZSxLQUExQjs7QUFFQSxlQUFPLEtBQUtoQixTQUFMLENBQWVqRCxPQUFmLENBQXVCLEtBQUtrRCxVQUFMLEdBQWtCZSxLQUF6QyxLQUFtRCxDQUExRCxFQUE2RDtBQUMzREE7QUFDRDtBQUNGOztBQUVELFVBQUlJLFFBQVEsS0FBS3BELFVBQUwsQ0FBZ0JnRCxLQUFoQixDQUFaO0FBQ0EsYUFBT0ksU0FBUyxFQUFULElBQWVBLFNBQVMsRUFBL0I7QUFDRDs7O2lDQUVhRixJLEVBQU07QUFDbEIsVUFBSUUsUUFBUUYsS0FBS0csVUFBTCxDQUFnQixDQUFoQixDQUFaOztBQUVBLFdBQUssSUFBSWxELElBQUksS0FBSzhCLFVBQWxCLEVBQThCOUIsSUFBSSxLQUFLK0IsUUFBdkMsRUFBaUQvQixHQUFqRCxFQUFzRDtBQUNwRCxZQUFJLEtBQUs2QixTQUFMLENBQWVqRCxPQUFmLENBQXVCb0IsSUFBSSxLQUFLOEIsVUFBaEMsS0FBK0MsQ0FBbkQsRUFBc0Q7QUFDcEQ7QUFDRDs7QUFFRCxZQUFJLEtBQUtqQyxVQUFMLENBQWdCRyxDQUFoQixNQUF1QmlELEtBQTNCLEVBQWtDO0FBQ2hDLGlCQUFPLElBQVA7QUFDRDtBQUNGOztBQUVELGFBQU8sS0FBUDtBQUNEOzs7Ozs7SUFHRzFCLFc7QUFDSix1QkFBYTRCLE1BQWIsRUFBcUJ6QixRQUFyQixFQUErQjdCLFVBQS9CLEVBQXlEO0FBQUEsUUFBZDFCLE9BQWMsdUVBQUosRUFBSTs7QUFBQTs7QUFDdkQsU0FBSzBCLFVBQUwsR0FBa0JBLFVBQWxCO0FBQ0EsU0FBSzFCLE9BQUwsR0FBZUEsT0FBZjtBQUNBLFNBQUtnRixNQUFMLEdBQWNBLE1BQWQ7O0FBRUEsU0FBS0MsSUFBTCxHQUFZLEtBQUtDLFdBQUwsR0FBbUIsS0FBS0MsVUFBTCxFQUEvQjtBQUNBLFNBQUt4QyxHQUFMLEdBQVdZLFlBQVksQ0FBdkI7O0FBRUEsU0FBSzJCLFdBQUwsQ0FBaUJoRSxJQUFqQixHQUF3QixNQUF4Qjs7QUFFQSxTQUFLa0UsS0FBTCxHQUFhLFFBQWI7O0FBRUEsUUFBSSxLQUFLcEYsT0FBTCxDQUFhcUYsYUFBYixLQUErQkMsU0FBbkMsRUFBOEM7QUFDNUMsV0FBS3RGLE9BQUwsQ0FBYXFGLGFBQWIsR0FBNkIsSUFBN0I7QUFDRDs7QUFFRCxTQUFLRSxhQUFMO0FBQ0Q7Ozs7b0NBRWdCO0FBQUE7O0FBQ2YsVUFBSXpFLGFBQWEsRUFBakI7QUFDQSxVQUFJMEUsU0FBUzFFLFVBQWI7O0FBRUEsVUFBSTJFLE9BQU8sU0FBUEEsSUFBTyxPQUFRO0FBQ2pCLFlBQUlDLFlBQUo7QUFDQSxZQUFJQyxZQUFZSCxNQUFoQjtBQUNBLFlBQUlJLGdCQUFKOztBQUVBLFlBQUksQ0FBQ0MsS0FBS3BDLE1BQU4sSUFBZ0JvQyxLQUFLM0UsSUFBTCxLQUFjLFVBQTlCLElBQTRDMkUsS0FBS0MsTUFBTCxDQUFZLEdBQVosQ0FBaEQsRUFBa0U7QUFDaEVELGVBQUtwQyxNQUFMLEdBQWMsSUFBZDtBQUNBb0MsZUFBSzNFLElBQUwsR0FBWSxNQUFaO0FBQ0Q7O0FBRUQ7QUFDQSxZQUFJLENBQUMyRSxLQUFLcEMsTUFBVixFQUFrQjtBQUNoQixnQkFBTSxJQUFJUixLQUFKLENBQVUsMENBQTBDLE1BQUtOLEdBQUwsR0FBVyxNQUFLakIsVUFBTCxDQUFnQkksTUFBM0IsR0FBb0MsQ0FBOUUsQ0FBVixDQUFOO0FBQ0Q7O0FBRUQsZ0JBQVErRCxLQUFLM0UsSUFBTCxDQUFVUixXQUFWLEVBQVI7QUFDRSxlQUFLLFNBQUw7QUFDQSxlQUFLLFFBQUw7QUFDRWdGLGtCQUFNO0FBQ0p4RSxvQkFBTTJFLEtBQUszRSxJQUFMLENBQVVSLFdBQVYsRUFERjtBQUVKUyxxQkFBTyxNQUFLbkIsT0FBTCxDQUFhcUYsYUFBYixHQUE2QlEsS0FBS0UsUUFBTCxFQUE3QixHQUErQ0YsS0FBS2hDLGFBQUw7QUFGbEQsYUFBTjtBQUlBMkIsbUJBQU9yRCxJQUFQLENBQVl1RCxHQUFaO0FBQ0E7QUFDRixlQUFLLFVBQUw7QUFDRUEsa0JBQU07QUFDSnhFLG9CQUFNMkUsS0FBSzNFLElBQUwsQ0FBVVIsV0FBVixFQURGO0FBRUpTLHFCQUFPMEUsS0FBS0UsUUFBTDtBQUZILGFBQU47QUFJQVAsbUJBQU9yRCxJQUFQLENBQVl1RCxHQUFaO0FBQ0E7QUFDRixlQUFLLE1BQUw7QUFDRSxnQkFBSUcsS0FBS0MsTUFBTCxDQUFZLEtBQVosRUFBbUIsSUFBbkIsQ0FBSixFQUE4QjtBQUM1Qk4scUJBQU9yRCxJQUFQLENBQVksSUFBWjtBQUNBO0FBQ0Q7QUFDRHVELGtCQUFNO0FBQ0p4RSxvQkFBTTJFLEtBQUszRSxJQUFMLENBQVVSLFdBQVYsRUFERjtBQUVKUyxxQkFBTzBFLEtBQUtFLFFBQUw7QUFGSCxhQUFOO0FBSUFQLG1CQUFPckQsSUFBUCxDQUFZdUQsR0FBWjtBQUNBO0FBQ0YsZUFBSyxTQUFMO0FBQ0VGLHFCQUFTQSxPQUFPQSxPQUFPMUQsTUFBUCxHQUFnQixDQUF2QixFQUEwQmtFLE9BQTFCLEdBQW9DLEVBQTdDO0FBQ0E7QUFDRixlQUFLLE1BQUw7QUFDRU4sa0JBQU0sRUFBTjtBQUNBRixtQkFBT3JELElBQVAsQ0FBWXVELEdBQVo7QUFDQUYscUJBQVNFLEdBQVQ7QUFDQTtBQUNGLGVBQUssU0FBTDtBQUNFRSxzQkFBVUMsS0FBS0UsUUFBTCxHQUFnQkUsS0FBaEIsQ0FBc0IsR0FBdEIsRUFBMkJDLEdBQTNCLENBQStCQyxNQUEvQixDQUFWO0FBQ0FYLG1CQUFPQSxPQUFPMUQsTUFBUCxHQUFnQixDQUF2QixFQUEwQjhELE9BQTFCLEdBQW9DQSxPQUFwQztBQUNBO0FBdENKOztBQXlDQUMsYUFBS3JDLFVBQUwsQ0FBZ0JZLE9BQWhCLENBQXdCLFVBQVVnQyxTQUFWLEVBQXFCO0FBQzNDWCxlQUFLVyxTQUFMO0FBQ0QsU0FGRDtBQUdBWixpQkFBU0csU0FBVDtBQUNELE9BNUREOztBQThEQUYsV0FBSyxLQUFLUixJQUFWOztBQUVBLGFBQU9uRSxVQUFQO0FBQ0Q7OzsrQkFFV3dDLFUsRUFBWUMsUSxFQUFVO0FBQ2hDLGFBQU8sSUFBSUYsSUFBSixDQUFTLEtBQUszQixVQUFkLEVBQTBCNEIsVUFBMUIsRUFBc0NDLFFBQXRDLENBQVA7QUFDRDs7O29DQUVnQjtBQUFBOztBQUNmLFVBQUkxQixVQUFKO0FBQ0EsVUFBSXdFLFlBQUo7QUFDQSxVQUFNQyxVQUFVLFNBQVZBLE9BQVUsQ0FBQzNELEdBQUQsRUFBUztBQUN2QjtBQUNBLGVBQU8sT0FBS2pCLFVBQUwsQ0FBZ0JHLElBQUksQ0FBcEIsTUFBMkIsR0FBbEMsRUFBdUM7QUFDckNBO0FBQ0Q7QUFDRixPQUxEOztBQU9BLFdBQUtBLElBQUksQ0FBSixFQUFPd0UsTUFBTSxLQUFLM0UsVUFBTCxDQUFnQkksTUFBbEMsRUFBMENELElBQUl3RSxHQUE5QyxFQUFtRHhFLEdBQW5ELEVBQXdEO0FBQ3RELFlBQUkwRSxNQUFNbkUsT0FBT1gsWUFBUCxDQUFvQixLQUFLQyxVQUFMLENBQWdCRyxDQUFoQixDQUFwQixDQUFWOztBQUVBLGdCQUFRLEtBQUt1RCxLQUFiO0FBQ0UsZUFBSyxRQUFMOztBQUVFLG9CQUFRbUIsR0FBUjtBQUNFO0FBQ0EsbUJBQUssR0FBTDtBQUNFLHFCQUFLckIsV0FBTCxHQUFtQixLQUFLQyxVQUFMLENBQWdCLEtBQUtELFdBQXJCLEVBQWtDckQsQ0FBbEMsQ0FBbkI7QUFDQSxxQkFBS3FELFdBQUwsQ0FBaUJoRSxJQUFqQixHQUF3QixRQUF4QjtBQUNBLHFCQUFLa0UsS0FBTCxHQUFhLFFBQWI7QUFDQSxxQkFBS0YsV0FBTCxDQUFpQnpCLE1BQWpCLEdBQTBCLEtBQTFCO0FBQ0E7O0FBRUY7QUFDQSxtQkFBSyxHQUFMO0FBQ0UscUJBQUt5QixXQUFMLEdBQW1CLEtBQUtDLFVBQUwsQ0FBZ0IsS0FBS0QsV0FBckIsRUFBa0NyRCxDQUFsQyxDQUFuQjtBQUNBLHFCQUFLcUQsV0FBTCxDQUFpQmhFLElBQWpCLEdBQXdCLE1BQXhCO0FBQ0EscUJBQUtnRSxXQUFMLENBQWlCekIsTUFBakIsR0FBMEIsS0FBMUI7QUFDQTs7QUFFRjtBQUNBLG1CQUFLLEdBQUw7QUFDRSxvQkFBSSxLQUFLeUIsV0FBTCxDQUFpQmhFLElBQWpCLEtBQTBCLE1BQTlCLEVBQXNDO0FBQ3BDLHdCQUFNLElBQUkrQixLQUFKLENBQVUsK0NBQStDLEtBQUtOLEdBQUwsR0FBV2QsQ0FBMUQsQ0FBVixDQUFOO0FBQ0Q7O0FBRUQscUJBQUtxRCxXQUFMLENBQWlCekIsTUFBakIsR0FBMEIsSUFBMUI7QUFDQSxxQkFBS3lCLFdBQUwsQ0FBaUJzQixNQUFqQixHQUEwQixLQUFLN0QsR0FBTCxHQUFXZCxDQUFyQztBQUNBLHFCQUFLcUQsV0FBTCxHQUFtQixLQUFLQSxXQUFMLENBQWlCNUIsVUFBcEM7O0FBRUFnRDtBQUNBOztBQUVGO0FBQ0EsbUJBQUssR0FBTDtBQUNFLG9CQUFJLEtBQUtwQixXQUFMLENBQWlCaEUsSUFBakIsS0FBMEIsU0FBOUIsRUFBeUM7QUFDdkMsd0JBQU0sSUFBSStCLEtBQUosQ0FBVSxrREFBa0QsS0FBS04sR0FBTCxHQUFXZCxDQUE3RCxDQUFWLENBQU47QUFDRDtBQUNELHFCQUFLcUQsV0FBTCxDQUFpQnpCLE1BQWpCLEdBQTBCLElBQTFCO0FBQ0EscUJBQUt5QixXQUFMLENBQWlCc0IsTUFBakIsR0FBMEIsS0FBSzdELEdBQUwsR0FBV2QsQ0FBckM7QUFDQSxxQkFBS3FELFdBQUwsR0FBbUIsS0FBS0EsV0FBTCxDQUFpQjVCLFVBQXBDO0FBQ0FnRDtBQUNBOztBQUVGO0FBQ0EsbUJBQUssR0FBTDtBQUNFLG9CQUFJbEUsT0FBT1gsWUFBUCxDQUFvQixLQUFLQyxVQUFMLENBQWdCRyxJQUFJLENBQXBCLENBQXBCLE1BQWdELEdBQXBELEVBQXlEO0FBQ3ZELHVCQUFLcUQsV0FBTCxHQUFtQixLQUFLQyxVQUFMLENBQWdCLEtBQUtELFdBQXJCLEVBQWtDckQsQ0FBbEMsQ0FBbkI7QUFDQSx1QkFBS3FELFdBQUwsQ0FBaUJoRSxJQUFqQixHQUF3QixNQUF4QjtBQUNBLHVCQUFLZ0UsV0FBTCxDQUFpQnZCLFVBQWpCLEdBQThCOUIsQ0FBOUI7QUFDQSx1QkFBS3FELFdBQUwsQ0FBaUJ0QixRQUFqQixHQUE0Qi9CLElBQUksQ0FBaEM7QUFDQSx1QkFBS3VELEtBQUwsR0FBYSxNQUFiO0FBQ0QsaUJBTkQsTUFNTztBQUNMLHVCQUFLRixXQUFMLEdBQW1CLEtBQUtDLFVBQUwsQ0FBZ0IsS0FBS0QsV0FBckIsRUFBa0NyRCxDQUFsQyxDQUFuQjtBQUNBLHVCQUFLcUQsV0FBTCxDQUFpQmhFLElBQWpCLEdBQXdCLFNBQXhCO0FBQ0EsdUJBQUtrRSxLQUFMLEdBQWEsU0FBYjtBQUNBLHVCQUFLRixXQUFMLENBQWlCekIsTUFBakIsR0FBMEIsS0FBMUI7QUFDRDtBQUNEOztBQUVGO0FBQ0EsbUJBQUssR0FBTDtBQUNFLHFCQUFLeUIsV0FBTCxHQUFtQixLQUFLQyxVQUFMLENBQWdCLEtBQUtELFdBQXJCLEVBQWtDckQsQ0FBbEMsQ0FBbkI7QUFDQSxxQkFBS3FELFdBQUwsQ0FBaUJoRSxJQUFqQixHQUF3QixTQUF4QjtBQUNBLHFCQUFLa0UsS0FBTCxHQUFhLFNBQWI7QUFDQSxxQkFBS0YsV0FBTCxDQUFpQnpCLE1BQWpCLEdBQTBCLEtBQTFCO0FBQ0E7O0FBRUY7QUFDQSxtQkFBSyxHQUFMO0FBQ0UscUJBQUt5QixXQUFMLEdBQW1CLEtBQUtDLFVBQUwsQ0FBZ0IsS0FBS0QsV0FBckIsRUFBa0NyRCxDQUFsQyxDQUFuQjtBQUNBLHFCQUFLcUQsV0FBTCxDQUFpQmhFLElBQWpCLEdBQXdCLFVBQXhCO0FBQ0EscUJBQUtnRSxXQUFMLENBQWlCdkIsVUFBakIsR0FBOEI5QixDQUE5QjtBQUNBLHFCQUFLcUQsV0FBTCxDQUFpQnRCLFFBQWpCLEdBQTRCL0IsSUFBSSxDQUFoQztBQUNBLHFCQUFLcUQsV0FBTCxDQUFpQnpCLE1BQWpCLEdBQTBCLEtBQTFCO0FBQ0EscUJBQUsyQixLQUFMLEdBQWEsVUFBYjtBQUNBOztBQUVGO0FBQ0EsbUJBQUssR0FBTDtBQUNFO0FBQ0E7O0FBRUY7QUFDQSxtQkFBSyxHQUFMO0FBQ0U7QUFDQSxvQkFBSSxDQUFDLElBQUQsRUFBTyxJQUFQLEVBQWEsS0FBYixFQUFvQixLQUFwQixFQUEyQixTQUEzQixFQUFzQzNFLE9BQXRDLENBQThDLEtBQUt1RSxNQUFMLENBQVl6RSxPQUFaLENBQW9CRyxXQUFwQixFQUE5QyxLQUFvRixDQUFwRixJQUF5RixLQUFLd0UsV0FBTCxLQUFxQixLQUFLRCxJQUF2SCxFQUE2SDtBQUMzSCx1QkFBS0MsV0FBTCxDQUFpQnNCLE1BQWpCLEdBQTBCLEtBQUs3RCxHQUFMLEdBQVdkLENBQXJDOztBQUVBLHVCQUFLcUQsV0FBTCxHQUFtQixLQUFLQyxVQUFMLENBQWdCLEtBQUtELFdBQXJCLEVBQWtDckQsQ0FBbEMsQ0FBbkI7QUFDQSx1QkFBS3FELFdBQUwsQ0FBaUJoRSxJQUFqQixHQUF3QixNQUF4Qjs7QUFFQSx1QkFBS2dFLFdBQUwsR0FBbUIsS0FBS0MsVUFBTCxDQUFnQixLQUFLRCxXQUFyQixFQUFrQ3JELENBQWxDLENBQW5CO0FBQ0EsdUJBQUtxRCxXQUFMLENBQWlCaEUsSUFBakIsR0FBd0IsU0FBeEI7QUFDQSx1QkFBS2dFLFdBQUwsQ0FBaUJ6QixNQUFqQixHQUEwQixLQUExQjtBQUNBLHVCQUFLMkIsS0FBTCxHQUFhLFFBQWI7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxzQkFBSTNELGFBQWEsS0FBS0MsVUFBTCxDQUFnQlksUUFBaEIsQ0FBeUJULElBQUksQ0FBN0IsRUFBZ0NBLElBQUksRUFBcEMsQ0FBYixFQUFzRG5CLFdBQXRELE9BQXdFLFdBQTVFLEVBQXlGO0FBQ3ZGO0FBQ0EseUJBQUt3RSxXQUFMLEdBQW1CLEtBQUtDLFVBQUwsQ0FBZ0IsS0FBS0QsV0FBckIsRUFBa0MsS0FBS3ZDLEdBQUwsR0FBV2QsQ0FBWCxHQUFlLENBQWpELENBQW5CO0FBQ0EseUJBQUtxRCxXQUFMLENBQWlCaEUsSUFBakIsR0FBd0IsTUFBeEI7QUFDQSx5QkFBS2dFLFdBQUwsQ0FBaUJzQixNQUFqQixHQUEwQixLQUFLN0QsR0FBTCxHQUFXZCxDQUFYLEdBQWUsQ0FBekM7QUFDQSx5QkFBS3FELFdBQUwsQ0FBaUJ2QixVQUFqQixHQUE4QjlCLElBQUksQ0FBbEM7QUFDQSx5QkFBS3FELFdBQUwsQ0FBaUJ0QixRQUFqQixHQUE0Qi9CLElBQUksQ0FBaEM7QUFDQSx5QkFBS3FELFdBQUwsQ0FBaUJwQixnQkFBakIsR0FBb0MsSUFBcEM7QUFDQSx5QkFBS29CLFdBQUwsR0FBbUIsS0FBS0EsV0FBTCxDQUFpQjVCLFVBQXBDOztBQUVBO0FBQ0EseUJBQUs0QixXQUFMLEdBQW1CLEtBQUtDLFVBQUwsQ0FBZ0IsS0FBS0QsV0FBckIsRUFBa0MsS0FBS3ZDLEdBQUwsR0FBV2QsQ0FBWCxHQUFlLEVBQWpELENBQW5CO0FBQ0E7QUFDQSx5QkFBS3FELFdBQUwsQ0FBaUJoRSxJQUFqQixHQUF3QixNQUF4QjtBQUNBO0FBQ0FXLHdCQUFJLEtBQUtILFVBQUwsQ0FBZ0JqQixPQUFoQixDQUF3QmUsbUJBQXhCLEVBQTZDSyxJQUFJLEVBQWpELENBQUo7QUFDQSx5QkFBS3FELFdBQUwsQ0FBaUJzQixNQUFqQixHQUEwQixLQUFLN0QsR0FBTCxHQUFXZCxDQUFYLEdBQWUsQ0FBekM7QUFDQSx5QkFBS3FELFdBQUwsQ0FBaUJ2QixVQUFqQixHQUE4QixLQUFLdUIsV0FBTCxDQUFpQjNCLFFBQWpCLEdBQTRCLEtBQUtaLEdBQS9EO0FBQ0EseUJBQUt1QyxXQUFMLENBQWlCdEIsUUFBakIsR0FBNEIsS0FBS3NCLFdBQUwsQ0FBaUJzQixNQUFqQixHQUEwQixLQUFLN0QsR0FBL0IsR0FBcUMsQ0FBakU7QUFDQSx5QkFBS3VDLFdBQUwsR0FBbUIsS0FBS0EsV0FBTCxDQUFpQjVCLFVBQXBDOztBQUVBO0FBQ0EseUJBQUs0QixXQUFMLENBQWlCekIsTUFBakIsR0FBMEIsSUFBMUI7QUFDQSx5QkFBS3lCLFdBQUwsR0FBbUIsS0FBS0EsV0FBTCxDQUFpQjVCLFVBQXBDO0FBQ0FnRDtBQUNEOztBQUVEO0FBQ0Q7QUFDSDtBQUNBO0FBQ0U7QUFDQTtBQUNBO0FBQ0Esb0JBQUksK0JBQVk3RixPQUFaLENBQW9COEYsR0FBcEIsSUFBMkIsQ0FBM0IsSUFBZ0NBLFFBQVEsSUFBeEMsSUFBZ0RBLFFBQVEsR0FBNUQsRUFBaUU7QUFDL0Qsd0JBQU0sSUFBSXRELEtBQUosQ0FBVSxrQ0FBa0MsS0FBS04sR0FBTCxHQUFXZCxDQUE3QyxDQUFWLENBQU47QUFDRDs7QUFFRCxxQkFBS3FELFdBQUwsR0FBbUIsS0FBS0MsVUFBTCxDQUFnQixLQUFLRCxXQUFyQixFQUFrQ3JELENBQWxDLENBQW5CO0FBQ0EscUJBQUtxRCxXQUFMLENBQWlCaEUsSUFBakIsR0FBd0IsTUFBeEI7QUFDQSxxQkFBS2dFLFdBQUwsQ0FBaUJ2QixVQUFqQixHQUE4QjlCLENBQTlCO0FBQ0EscUJBQUtxRCxXQUFMLENBQWlCdEIsUUFBakIsR0FBNEIvQixJQUFJLENBQWhDO0FBQ0EscUJBQUt1RCxLQUFMLEdBQWEsTUFBYjtBQUNBO0FBNUlKO0FBOElBOztBQUVGLGVBQUssTUFBTDs7QUFFRTtBQUNBLGdCQUFJbUIsUUFBUSxHQUFaLEVBQWlCO0FBQ2YsbUJBQUtyQixXQUFMLENBQWlCc0IsTUFBakIsR0FBMEIsS0FBSzdELEdBQUwsR0FBV2QsQ0FBWCxHQUFlLENBQXpDO0FBQ0EsbUJBQUtxRCxXQUFMLEdBQW1CLEtBQUtBLFdBQUwsQ0FBaUI1QixVQUFwQztBQUNBLG1CQUFLOEIsS0FBTCxHQUFhLFFBQWI7QUFDQTtBQUNEOztBQUVEO0FBQ0EsZ0JBQ0UsS0FBS0YsV0FBTCxDQUFpQjVCLFVBQWpCLEtBRUdpRCxRQUFRLEdBQVIsSUFBZSxLQUFLckIsV0FBTCxDQUFpQjVCLFVBQWpCLENBQTRCcEMsSUFBNUIsS0FBcUMsTUFBckQsSUFDQ3FGLFFBQVEsR0FBUixJQUFlLEtBQUtyQixXQUFMLENBQWlCNUIsVUFBakIsQ0FBNEJwQyxJQUE1QixLQUFxQyxTQUh2RCxDQURGLEVBTUU7QUFDQSxtQkFBS2dFLFdBQUwsQ0FBaUJzQixNQUFqQixHQUEwQixLQUFLN0QsR0FBTCxHQUFXZCxDQUFYLEdBQWUsQ0FBekM7QUFDQSxtQkFBS3FELFdBQUwsR0FBbUIsS0FBS0EsV0FBTCxDQUFpQjVCLFVBQXBDOztBQUVBLG1CQUFLNEIsV0FBTCxDQUFpQnpCLE1BQWpCLEdBQTBCLElBQTFCO0FBQ0EsbUJBQUt5QixXQUFMLENBQWlCc0IsTUFBakIsR0FBMEIsS0FBSzdELEdBQUwsR0FBV2QsQ0FBckM7QUFDQSxtQkFBS3FELFdBQUwsR0FBbUIsS0FBS0EsV0FBTCxDQUFpQjVCLFVBQXBDO0FBQ0EsbUJBQUs4QixLQUFMLEdBQWEsUUFBYjs7QUFFQWtCO0FBQ0E7QUFDRDs7QUFFRCxnQkFBSSxDQUFDQyxRQUFRLEdBQVIsSUFBZUEsUUFBUSxHQUF4QixLQUFnQyxLQUFLckIsV0FBTCxDQUFpQnVCLFFBQWpCLEVBQXBDLEVBQWlFO0FBQy9ELG1CQUFLdkIsV0FBTCxDQUFpQmhFLElBQWpCLEdBQXdCLFVBQXhCO0FBQ0EsbUJBQUtnRSxXQUFMLENBQWlCekIsTUFBakIsR0FBMEIsSUFBMUI7QUFDQSxtQkFBSzJCLEtBQUwsR0FBYSxVQUFiO0FBQ0Q7O0FBRUQ7QUFDQSxnQkFBSW1CLFFBQVEsR0FBUixLQUFnQixLQUFLckIsV0FBTCxDQUFpQlksTUFBakIsQ0FBd0IsTUFBeEIsRUFBZ0MsS0FBaEMsS0FBMEMsS0FBS1osV0FBTCxDQUFpQlksTUFBakIsQ0FBd0IsV0FBeEIsRUFBcUMsS0FBckMsQ0FBMUQsQ0FBSixFQUE0RztBQUMxRyxtQkFBS1osV0FBTCxDQUFpQnNCLE1BQWpCLEdBQTBCLEtBQUs3RCxHQUFMLEdBQVdkLENBQXJDO0FBQ0EsbUJBQUtxRCxXQUFMLEdBQW1CLEtBQUtDLFVBQUwsQ0FBZ0IsS0FBS0QsV0FBTCxDQUFpQjVCLFVBQWpDLEVBQTZDLEtBQUtYLEdBQUwsR0FBV2QsQ0FBeEQsQ0FBbkI7QUFDQSxtQkFBS3FELFdBQUwsQ0FBaUJoRSxJQUFqQixHQUF3QixTQUF4QjtBQUNBLG1CQUFLZ0UsV0FBTCxDQUFpQnpCLE1BQWpCLEdBQTBCLEtBQTFCO0FBQ0EsbUJBQUsyQixLQUFMLEdBQWEsUUFBYjtBQUNBO0FBQ0Q7O0FBRUQsZ0JBQUltQixRQUFRLEdBQVosRUFBaUI7QUFDZixvQkFBTSxJQUFJdEQsS0FBSixDQUFVLDZDQUE2QyxLQUFLTixHQUE1RCxDQUFOO0FBQ0Q7O0FBRUQ7QUFDQSxnQkFBSSwrQkFBWWxDLE9BQVosQ0FBb0I4RixHQUFwQixJQUEyQixDQUEzQixJQUFnQyw0QkFBUzlGLE9BQVQsQ0FBaUI4RixHQUFqQixJQUF3QixDQUF4RCxJQUE2REEsUUFBUSxHQUFyRSxJQUE0RSxFQUFFQSxRQUFRLEdBQVIsSUFBZSxLQUFLckIsV0FBTCxDQUFpQlksTUFBakIsQ0FBd0IsSUFBeEIsQ0FBakIsQ0FBaEYsRUFBaUk7QUFDL0gsb0JBQU0sSUFBSTdDLEtBQUosQ0FBVSxrQ0FBa0MsS0FBS04sR0FBTCxHQUFXZCxDQUE3QyxDQUFWLENBQU47QUFDRCxhQUZELE1BRU8sSUFBSSxLQUFLcUQsV0FBTCxDQUFpQlksTUFBakIsQ0FBd0IsS0FBeEIsQ0FBSixFQUFvQztBQUN6QyxvQkFBTSxJQUFJN0MsS0FBSixDQUFVLGtDQUFrQyxLQUFLTixHQUFMLEdBQVdkLENBQTdDLENBQVYsQ0FBTjtBQUNEOztBQUVELGlCQUFLcUQsV0FBTCxDQUFpQnRCLFFBQWpCLEdBQTRCL0IsSUFBSSxDQUFoQztBQUNBOztBQUVGLGVBQUssUUFBTDs7QUFFRTtBQUNBLGdCQUFJMEUsUUFBUSxHQUFaLEVBQWlCO0FBQ2YsbUJBQUtyQixXQUFMLENBQWlCc0IsTUFBakIsR0FBMEIsS0FBSzdELEdBQUwsR0FBV2QsQ0FBckM7QUFDQSxtQkFBS3FELFdBQUwsQ0FBaUJ6QixNQUFqQixHQUEwQixJQUExQjtBQUNBLG1CQUFLeUIsV0FBTCxHQUFtQixLQUFLQSxXQUFMLENBQWlCNUIsVUFBcEM7QUFDQSxtQkFBSzhCLEtBQUwsR0FBYSxRQUFiOztBQUVBa0I7QUFDQTtBQUNEOztBQUVEO0FBQ0EsZ0JBQUlDLFFBQVEsSUFBWixFQUFrQjtBQUNoQixtQkFBS3JCLFdBQUwsQ0FBaUJ4QixTQUFqQixDQUEyQnZCLElBQTNCLENBQWdDTixJQUFJLEtBQUtxRCxXQUFMLENBQWlCdkIsVUFBckQ7QUFDQTlCO0FBQ0Esa0JBQUlBLEtBQUt3RSxHQUFULEVBQWM7QUFDWixzQkFBTSxJQUFJcEQsS0FBSixDQUFVLDBDQUEwQyxLQUFLTixHQUFMLEdBQVdkLENBQXJELENBQVYsQ0FBTjtBQUNEO0FBQ0QwRSxvQkFBTW5FLE9BQU9YLFlBQVAsQ0FBb0IsS0FBS0MsVUFBTCxDQUFnQkcsQ0FBaEIsQ0FBcEIsQ0FBTjtBQUNEOztBQUVEOzs7Ozs7QUFNQSxpQkFBS3FELFdBQUwsQ0FBaUJ0QixRQUFqQixHQUE0Qi9CLElBQUksQ0FBaEM7QUFDQTs7QUFFRixlQUFLLFNBQUw7QUFDRSxnQkFBSTBFLFFBQVEsR0FBWixFQUFpQjtBQUNmLGtCQUFJLEtBQUtyQixXQUFMLENBQWlCVCxRQUFqQixDQUEwQixHQUExQixFQUErQixDQUFDLENBQWhDLENBQUosRUFBd0M7QUFDdEMsc0JBQU0sSUFBSXhCLEtBQUosQ0FBVSwyQ0FBMkMsS0FBS04sR0FBMUQsQ0FBTjtBQUNEO0FBQ0QsbUJBQUt1QyxXQUFMLENBQWlCc0IsTUFBakIsR0FBMEIsS0FBSzdELEdBQUwsR0FBV2QsQ0FBckM7QUFDQSxtQkFBS3FELFdBQUwsQ0FBaUJ6QixNQUFqQixHQUEwQixJQUExQjtBQUNBLG1CQUFLeUIsV0FBTCxHQUFtQixLQUFLQSxXQUFMLENBQWlCNUIsVUFBcEM7QUFDQSxtQkFBSzhCLEtBQUwsR0FBYSxRQUFiO0FBQ0FrQjtBQUNBO0FBQ0Q7O0FBRUQsZ0JBQUlDLFFBQVEsR0FBUixLQUFnQixDQUFDLEtBQUtyQixXQUFMLENBQWlCVixjQUFqQixFQUFELElBQXNDLEtBQUtVLFdBQUwsQ0FBaUJ3QixZQUFqQixDQUE4QixHQUE5QixDQUF0RCxDQUFKLEVBQStGO0FBQzdGLG9CQUFNLElBQUl6RCxLQUFKLENBQVUsZ0RBQWdELEtBQUtOLEdBQS9ELENBQU47QUFDRDs7QUFFRCxnQkFBSSwyQkFBUWxDLE9BQVIsQ0FBZ0I4RixHQUFoQixJQUF1QixDQUF2QixJQUE0QkEsUUFBUSxHQUF4QyxFQUE2QztBQUMzQyxvQkFBTSxJQUFJdEQsS0FBSixDQUFVLGtDQUFrQyxLQUFLTixHQUFMLEdBQVdkLENBQTdDLENBQVYsQ0FBTjtBQUNEOztBQUVELGdCQUFJMEUsUUFBUSxHQUFSLEtBQWdCLEtBQUtyQixXQUFMLENBQWlCWSxNQUFqQixDQUF3QixHQUF4QixLQUFnQyxLQUFLWixXQUFMLENBQWlCVCxRQUFqQixDQUEwQixJQUExQixFQUFnQyxDQUFDLENBQWpDLENBQWhELENBQUosRUFBMEY7QUFDeEYsb0JBQU0sSUFBSXhCLEtBQUosQ0FBVSxrQ0FBa0MsS0FBS04sR0FBTCxHQUFXZCxDQUE3QyxDQUFWLENBQU47QUFDRDs7QUFFRCxpQkFBS3FELFdBQUwsQ0FBaUJ0QixRQUFqQixHQUE0Qi9CLElBQUksQ0FBaEM7QUFDQTs7QUFFRixlQUFLLFNBQUw7QUFDRSxnQkFBSSxLQUFLcUQsV0FBTCxDQUFpQnlCLE9BQXJCLEVBQThCO0FBQzVCLGtCQUFJSixRQUFRLElBQVosRUFBc0I7QUFDcEIsc0JBQU0sSUFBSXRELEtBQUosQ0FBVSxtQ0FBbUMsS0FBS04sR0FBTCxHQUFXZCxDQUE5QyxDQUFWLENBQU47QUFDRDtBQUNELG1CQUFLcUQsV0FBTCxDQUFpQnRCLFFBQWpCLEdBQTRCL0IsSUFBSSxDQUFoQzs7QUFFQSxrQkFBSSxLQUFLcUQsV0FBTCxDQUFpQlYsY0FBakIsTUFBcUMsS0FBS1UsV0FBTCxDQUFpQjBCLGFBQTFELEVBQXlFO0FBQ3ZFLHFCQUFLMUIsV0FBTCxDQUFpQnNCLE1BQWpCLEdBQTBCLEtBQUs3RCxHQUFMLEdBQVdkLENBQXJDO0FBQ0EscUJBQUtxRCxXQUFMLENBQWlCekIsTUFBakIsR0FBMEIsSUFBMUI7QUFDQSxxQkFBS3lCLFdBQUwsR0FBbUIsS0FBS0EsV0FBTCxDQUFpQjVCLFVBQXBDO0FBQ0EscUJBQUs4QixLQUFMLEdBQWEsUUFBYjtBQUNBa0I7QUFDRDtBQUNEO0FBQ0Q7O0FBRUQsZ0JBQUlDLFFBQVEsR0FBUixJQUFlLEtBQUt2RyxPQUFMLENBQWE2RyxXQUFoQyxFQUE2QztBQUMzQyxtQkFBSzNCLFdBQUwsQ0FBaUIyQixXQUFqQixHQUErQixJQUEvQjtBQUNBO0FBQ0Q7O0FBRUQsZ0JBQUlOLFFBQVEsR0FBWixFQUFpQjtBQUNmLGtCQUFJLEVBQUUsbUJBQW1CLEtBQUtyQixXQUExQixDQUFKLEVBQTRDO0FBQzFDLHNCQUFNLElBQUlqQyxLQUFKLENBQVUsdURBQXVELEtBQUtOLEdBQUwsR0FBV2QsQ0FBbEUsQ0FBVixDQUFOO0FBQ0Q7QUFDRCxrQkFBSSxLQUFLSCxVQUFMLENBQWdCRyxJQUFJLENBQXBCLE1BQTJCVCxRQUEvQixFQUF5QztBQUN2Q1M7QUFDRCxlQUZELE1BRU8sSUFBSSxLQUFLSCxVQUFMLENBQWdCRyxJQUFJLENBQXBCLE1BQTJCUixRQUEzQixJQUF1QyxLQUFLSyxVQUFMLENBQWdCRyxJQUFJLENBQXBCLE1BQTJCVCxRQUF0RSxFQUFnRjtBQUNyRlMscUJBQUssQ0FBTDtBQUNELGVBRk0sTUFFQTtBQUNMLHNCQUFNLElBQUlvQixLQUFKLENBQVUsa0NBQWtDLEtBQUtOLEdBQUwsR0FBV2QsQ0FBN0MsQ0FBVixDQUFOO0FBQ0Q7QUFDRCxtQkFBS3FELFdBQUwsQ0FBaUJ2QixVQUFqQixHQUE4QjlCLElBQUksQ0FBbEM7QUFDQSxtQkFBS3FELFdBQUwsQ0FBaUIwQixhQUFqQixHQUFpQ1QsT0FBTyxLQUFLakIsV0FBTCxDQUFpQjBCLGFBQXhCLENBQWpDO0FBQ0EsbUJBQUsxQixXQUFMLENBQWlCeUIsT0FBakIsR0FBMkIsSUFBM0I7O0FBRUEsa0JBQUksQ0FBQyxLQUFLekIsV0FBTCxDQUFpQjBCLGFBQXRCLEVBQXFDO0FBQ25DO0FBQ0E7QUFDQSxxQkFBSzFCLFdBQUwsQ0FBaUJzQixNQUFqQixHQUEwQixLQUFLN0QsR0FBTCxHQUFXZCxDQUFyQztBQUNBLHFCQUFLcUQsV0FBTCxDQUFpQnpCLE1BQWpCLEdBQTBCLElBQTFCO0FBQ0EscUJBQUt5QixXQUFMLEdBQW1CLEtBQUtBLFdBQUwsQ0FBaUI1QixVQUFwQztBQUNBLHFCQUFLOEIsS0FBTCxHQUFhLFFBQWI7QUFDQWtCO0FBQ0Q7QUFDRDtBQUNEO0FBQ0QsZ0JBQUksMkJBQVE3RixPQUFSLENBQWdCOEYsR0FBaEIsSUFBdUIsQ0FBM0IsRUFBOEI7QUFDNUIsb0JBQU0sSUFBSXRELEtBQUosQ0FBVSxrQ0FBa0MsS0FBS04sR0FBTCxHQUFXZCxDQUE3QyxDQUFWLENBQU47QUFDRDtBQUNELGdCQUFJLEtBQUtxRCxXQUFMLENBQWlCMEIsYUFBakIsS0FBbUMsR0FBdkMsRUFBNEM7QUFDMUMsb0JBQU0sSUFBSTNELEtBQUosQ0FBVSxrQ0FBa0MsS0FBS04sR0FBTCxHQUFXZCxDQUE3QyxDQUFWLENBQU47QUFDRDtBQUNELGlCQUFLcUQsV0FBTCxDQUFpQjBCLGFBQWpCLEdBQWlDLENBQUMsS0FBSzFCLFdBQUwsQ0FBaUIwQixhQUFqQixJQUFrQyxFQUFuQyxJQUF5Q0wsR0FBMUU7QUFDQTs7QUFFRixlQUFLLFVBQUw7QUFDRTtBQUNBLGdCQUFJQSxRQUFRLEdBQVosRUFBaUI7QUFDZixrQkFBSSxDQUFDLEtBQUtyQixXQUFMLENBQWlCTCxPQUFqQixDQUF5QixDQUFDLENBQTFCLENBQUQsSUFBaUMsQ0FBQyxLQUFLSyxXQUFMLENBQWlCVCxRQUFqQixDQUEwQixHQUExQixFQUErQixDQUFDLENBQWhDLENBQXRDLEVBQTBFO0FBQ3hFLHNCQUFNLElBQUl4QixLQUFKLENBQVUsd0NBQXdDLEtBQUtOLEdBQUwsR0FBV2QsQ0FBbkQsQ0FBVixDQUFOO0FBQ0Q7O0FBRUQsa0JBQUksS0FBS3FELFdBQUwsQ0FBaUJULFFBQWpCLENBQTBCLEdBQTFCLEVBQStCLENBQUMsQ0FBaEMsS0FBc0MsQ0FBQyxLQUFLUyxXQUFMLENBQWlCVCxRQUFqQixDQUEwQixHQUExQixFQUErQixDQUFDLENBQWhDLENBQTNDLEVBQStFO0FBQzdFLHNCQUFNLElBQUl4QixLQUFKLENBQVUsd0NBQXdDLEtBQUtOLEdBQUwsR0FBV2QsQ0FBbkQsQ0FBVixDQUFOO0FBQ0Q7O0FBRUQsbUJBQUtxRCxXQUFMLENBQWlCekIsTUFBakIsR0FBMEIsSUFBMUI7QUFDQSxtQkFBS3lCLFdBQUwsQ0FBaUJzQixNQUFqQixHQUEwQixLQUFLN0QsR0FBTCxHQUFXZCxDQUFYLEdBQWUsQ0FBekM7QUFDQSxtQkFBS3FELFdBQUwsR0FBbUIsS0FBS0EsV0FBTCxDQUFpQjVCLFVBQXBDO0FBQ0EsbUJBQUs4QixLQUFMLEdBQWEsUUFBYjtBQUNBO0FBQ0QsYUFkRCxNQWNPLElBQUksS0FBS0YsV0FBTCxDQUFpQjVCLFVBQWpCLElBQ1RpRCxRQUFRLEdBREMsSUFFVCxLQUFLckIsV0FBTCxDQUFpQjVCLFVBQWpCLENBQTRCcEMsSUFBNUIsS0FBcUMsU0FGaEMsRUFFMkM7QUFDaEQsbUJBQUtnRSxXQUFMLENBQWlCc0IsTUFBakIsR0FBMEIsS0FBSzdELEdBQUwsR0FBV2QsQ0FBWCxHQUFlLENBQXpDO0FBQ0EsbUJBQUtxRCxXQUFMLEdBQW1CLEtBQUtBLFdBQUwsQ0FBaUI1QixVQUFwQzs7QUFFQSxtQkFBSzRCLFdBQUwsQ0FBaUJ6QixNQUFqQixHQUEwQixJQUExQjtBQUNBLG1CQUFLeUIsV0FBTCxDQUFpQnNCLE1BQWpCLEdBQTBCLEtBQUs3RCxHQUFMLEdBQVdkLENBQXJDO0FBQ0EsbUJBQUtxRCxXQUFMLEdBQW1CLEtBQUtBLFdBQUwsQ0FBaUI1QixVQUFwQztBQUNBLG1CQUFLOEIsS0FBTCxHQUFhLFFBQWI7O0FBRUFrQjtBQUNBO0FBQ0Q7O0FBRUQsZ0JBQUlDLFFBQVEsR0FBWixFQUFpQjtBQUNmLGtCQUFJLENBQUMsS0FBS3JCLFdBQUwsQ0FBaUJMLE9BQWpCLENBQXlCLENBQUMsQ0FBMUIsQ0FBRCxJQUFpQyxDQUFDLEtBQUtLLFdBQUwsQ0FBaUJULFFBQWpCLENBQTBCLEdBQTFCLEVBQStCLENBQUMsQ0FBaEMsQ0FBdEMsRUFBMEU7QUFDeEUsc0JBQU0sSUFBSXhCLEtBQUosQ0FBVSwrQ0FBK0MsS0FBS04sR0FBTCxHQUFXZCxDQUExRCxDQUFWLENBQU47QUFDRDtBQUNGLGFBSkQsTUFJTyxJQUFJMEUsUUFBUSxHQUFaLEVBQWlCO0FBQ3RCLGtCQUFJLENBQUMsS0FBS3JCLFdBQUwsQ0FBaUJULFFBQWpCLENBQTBCLEdBQTFCLEVBQStCLENBQUMsQ0FBaEMsQ0FBRCxJQUF1QyxDQUFDLEtBQUtTLFdBQUwsQ0FBaUJULFFBQWpCLENBQTBCLEdBQTFCLEVBQStCLENBQUMsQ0FBaEMsQ0FBNUMsRUFBZ0Y7QUFDOUUsc0JBQU0sSUFBSXhCLEtBQUosQ0FBVSw0Q0FBNEMsS0FBS04sR0FBTCxHQUFXZCxDQUF2RCxDQUFWLENBQU47QUFDRDtBQUNGLGFBSk0sTUFJQSxJQUFJMEUsUUFBUSxHQUFaLEVBQWlCO0FBQ3RCLGtCQUFJLENBQUMsS0FBS3JCLFdBQUwsQ0FBaUJMLE9BQWpCLENBQXlCLENBQUMsQ0FBMUIsQ0FBRCxJQUFpQyxDQUFDLEtBQUtLLFdBQUwsQ0FBaUJULFFBQWpCLENBQTBCLEdBQTFCLEVBQStCLENBQUMsQ0FBaEMsQ0FBdEMsRUFBMEU7QUFDeEUsc0JBQU0sSUFBSXhCLEtBQUosQ0FBVSxrREFBa0QsS0FBS04sR0FBTCxHQUFXZCxDQUE3RCxDQUFWLENBQU47QUFDRDtBQUNELGtCQUFJLEtBQUtxRCxXQUFMLENBQWlCVCxRQUFqQixDQUEwQixHQUExQixFQUErQixDQUFDLENBQWhDLEtBQXNDLENBQUMsS0FBS1MsV0FBTCxDQUFpQlQsUUFBakIsQ0FBMEIsR0FBMUIsRUFBK0IsQ0FBQyxDQUFoQyxDQUEzQyxFQUErRTtBQUM3RSxzQkFBTSxJQUFJeEIsS0FBSixDQUFVLGtEQUFrRCxLQUFLTixHQUFMLEdBQVdkLENBQTdELENBQVYsQ0FBTjtBQUNEO0FBQ0YsYUFQTSxNQU9BLElBQUksQ0FBQyxLQUFLaUYsSUFBTCxDQUFVUCxHQUFWLENBQUwsRUFBcUI7QUFDMUIsb0JBQU0sSUFBSXRELEtBQUosQ0FBVSxrQ0FBa0MsS0FBS04sR0FBTCxHQUFXZCxDQUE3QyxDQUFWLENBQU47QUFDRDs7QUFFRCxnQkFBSSxLQUFLaUYsSUFBTCxDQUFVUCxHQUFWLEtBQWtCLEtBQUtyQixXQUFMLENBQWlCVCxRQUFqQixDQUEwQixHQUExQixFQUErQixDQUFDLENBQWhDLENBQXRCLEVBQTBEO0FBQ3hELG9CQUFNLElBQUl4QixLQUFKLENBQVUsb0NBQW9DLEtBQUtOLEdBQUwsR0FBV2QsQ0FBL0MsQ0FBVixDQUFOO0FBQ0Q7O0FBRUQsaUJBQUtxRCxXQUFMLENBQWlCdEIsUUFBakIsR0FBNEIvQixJQUFJLENBQWhDO0FBQ0E7QUEzWEo7QUE2WEQ7QUFDRiIsImZpbGUiOiJwYXJzZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICBTUCwgRElHSVQsIEFUT01fQ0hBUixcbiAgVEFHLCBDT01NQU5ELCB2ZXJpZnksIERRVU9URVxufSBmcm9tICcuL2Zvcm1hbC1zeW50YXgnXG5cbmxldCBBU0NJSV9OTCA9IDEwXG5sZXQgQVNDSUlfQ1IgPSAxM1xubGV0IEFTQ0lJX1NQQUNFID0gMzJcbmxldCBBU0NJSV9MRUZUX0JSQUNLRVQgPSA5MVxubGV0IEFTQ0lJX1JJR0hUX0JSQUNLRVQgPSA5M1xuXG5mdW5jdGlvbiBmcm9tQ2hhckNvZGUgKHVpbnQ4QXJyYXkpIHtcbiAgY29uc3QgYmF0Y2hTaXplID0gMTAyNDBcbiAgdmFyIHN0cmluZ3MgPSBbXVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdWludDhBcnJheS5sZW5ndGg7IGkgKz0gYmF0Y2hTaXplKSB7XG4gICAgY29uc3QgYmVnaW4gPSBpXG4gICAgY29uc3QgZW5kID0gTWF0aC5taW4oaSArIGJhdGNoU2l6ZSwgdWludDhBcnJheS5sZW5ndGgpXG4gICAgc3RyaW5ncy5wdXNoKFN0cmluZy5mcm9tQ2hhckNvZGUuYXBwbHkobnVsbCwgdWludDhBcnJheS5zdWJhcnJheShiZWdpbiwgZW5kKSkpXG4gIH1cblxuICByZXR1cm4gc3RyaW5ncy5qb2luKCcnKVxufVxuXG5mdW5jdGlvbiBmcm9tQ2hhckNvZGVUcmltbWVkICh1aW50OEFycmF5KSB7XG4gIGxldCBiZWdpbiA9IDBcbiAgbGV0IGVuZCA9IHVpbnQ4QXJyYXkubGVuZ3RoXG5cbiAgd2hpbGUgKHVpbnQ4QXJyYXlbYmVnaW5dID09PSBBU0NJSV9TUEFDRSkge1xuICAgIGJlZ2luKytcbiAgfVxuXG4gIHdoaWxlICh1aW50OEFycmF5W2VuZCAtIDFdID09PSBBU0NJSV9TUEFDRSkge1xuICAgIGVuZC0tXG4gIH1cblxuICBpZiAoYmVnaW4gIT09IDAgfHwgZW5kICE9PSB1aW50OEFycmF5Lmxlbmd0aCkge1xuICAgIHVpbnQ4QXJyYXkgPSB1aW50OEFycmF5LnN1YmFycmF5KGJlZ2luLCBlbmQpXG4gIH1cblxuICByZXR1cm4gZnJvbUNoYXJDb2RlKHVpbnQ4QXJyYXkpXG59XG5cbmZ1bmN0aW9uIGlzRW1wdHkgKHVpbnQ4QXJyYXkpIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB1aW50OEFycmF5Lmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKHVpbnQ4QXJyYXlbaV0gIT09IEFTQ0lJX1NQQUNFKSB7XG4gICAgICByZXR1cm4gZmFsc2VcbiAgICB9XG4gIH1cblxuICByZXR1cm4gdHJ1ZVxufVxuXG5jbGFzcyBQYXJzZXJJbnN0YW5jZSB7XG4gIGNvbnN0cnVjdG9yIChpbnB1dCwgb3B0aW9ucykge1xuICAgIHRoaXMucmVtYWluZGVyID0gbmV3IFVpbnQ4QXJyYXkoaW5wdXQgfHwgMClcbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zIHx8IHt9XG4gICAgdGhpcy5wb3MgPSAwXG4gIH1cbiAgZ2V0VGFnICgpIHtcbiAgICBpZiAoIXRoaXMudGFnKSB7XG4gICAgICB0aGlzLnRhZyA9IHRoaXMuZ2V0RWxlbWVudChUQUcoKSArICcqKycsIHRydWUpXG4gICAgfVxuICAgIHJldHVybiB0aGlzLnRhZ1xuICB9XG5cbiAgZ2V0Q29tbWFuZCAoKSB7XG4gICAgaWYgKCF0aGlzLmNvbW1hbmQpIHtcbiAgICAgIHRoaXMuY29tbWFuZCA9IHRoaXMuZ2V0RWxlbWVudChDT01NQU5EKCkpXG4gICAgfVxuXG4gICAgc3dpdGNoICgodGhpcy5jb21tYW5kIHx8ICcnKS50b1N0cmluZygpLnRvVXBwZXJDYXNlKCkpIHtcbiAgICAgIGNhc2UgJ09LJzpcbiAgICAgIGNhc2UgJ05PJzpcbiAgICAgIGNhc2UgJ0JBRCc6XG4gICAgICBjYXNlICdQUkVBVVRIJzpcbiAgICAgIGNhc2UgJ0JZRSc6XG4gICAgICAgIGxldCBsYXN0UmlnaHRCcmFja2V0ID0gdGhpcy5yZW1haW5kZXIubGFzdEluZGV4T2YoQVNDSUlfUklHSFRfQlJBQ0tFVClcbiAgICAgICAgaWYgKHRoaXMucmVtYWluZGVyWzFdID09PSBBU0NJSV9MRUZUX0JSQUNLRVQgJiYgbGFzdFJpZ2h0QnJhY2tldCA+IDEpIHtcbiAgICAgICAgICB0aGlzLmh1bWFuUmVhZGFibGUgPSBmcm9tQ2hhckNvZGVUcmltbWVkKHRoaXMucmVtYWluZGVyLnN1YmFycmF5KGxhc3RSaWdodEJyYWNrZXQgKyAxKSlcbiAgICAgICAgICB0aGlzLnJlbWFpbmRlciA9IHRoaXMucmVtYWluZGVyLnN1YmFycmF5KDAsIGxhc3RSaWdodEJyYWNrZXQgKyAxKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMuaHVtYW5SZWFkYWJsZSA9IGZyb21DaGFyQ29kZVRyaW1tZWQodGhpcy5yZW1haW5kZXIpXG4gICAgICAgICAgdGhpcy5yZW1haW5kZXIgPSBuZXcgVWludDhBcnJheSgwKVxuICAgICAgICB9XG4gICAgICAgIGJyZWFrXG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuY29tbWFuZFxuICB9XG5cbiAgZ2V0RWxlbWVudCAoc3ludGF4KSB7XG4gICAgbGV0IGVsZW1lbnRcbiAgICBpZiAodGhpcy5yZW1haW5kZXJbMF0gPT09IEFTQ0lJX1NQQUNFKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgd2hpdGVzcGFjZSBhdCBwb3NpdGlvbiAnICsgdGhpcy5wb3MpXG4gICAgfVxuXG4gICAgbGV0IGZpcnN0U3BhY2UgPSB0aGlzLnJlbWFpbmRlci5pbmRleE9mKEFTQ0lJX1NQQUNFKVxuICAgIGlmICh0aGlzLnJlbWFpbmRlci5sZW5ndGggPiAwICYmIGZpcnN0U3BhY2UgIT09IDApIHtcbiAgICAgIGlmIChmaXJzdFNwYWNlID09PSAtMSkge1xuICAgICAgICBlbGVtZW50ID0gZnJvbUNoYXJDb2RlKHRoaXMucmVtYWluZGVyKVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZWxlbWVudCA9IGZyb21DaGFyQ29kZSh0aGlzLnJlbWFpbmRlci5zdWJhcnJheSgwLCBmaXJzdFNwYWNlKSlcbiAgICAgIH1cblxuICAgICAgY29uc3QgZXJyUG9zID0gdmVyaWZ5KGVsZW1lbnQsIHN5bnRheClcbiAgICAgIGlmIChlcnJQb3MgPj0gMCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgZXJyUG9zKSlcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGVuZCBvZiBpbnB1dCBhdCBwb3NpdGlvbiAnICsgdGhpcy5wb3MpXG4gICAgfVxuXG4gICAgdGhpcy5wb3MgKz0gZWxlbWVudC5sZW5ndGhcbiAgICB0aGlzLnJlbWFpbmRlciA9IHRoaXMucmVtYWluZGVyLnN1YmFycmF5KGVsZW1lbnQubGVuZ3RoKVxuXG4gICAgcmV0dXJuIGVsZW1lbnRcbiAgfVxuXG4gIGdldFNwYWNlICgpIHtcbiAgICBpZiAoIXRoaXMucmVtYWluZGVyLmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGVuZCBvZiBpbnB1dCBhdCBwb3NpdGlvbiAnICsgdGhpcy5wb3MpXG4gICAgfVxuXG4gICAgaWYgKHZlcmlmeShTdHJpbmcuZnJvbUNoYXJDb2RlKHRoaXMucmVtYWluZGVyWzBdKSwgU1AoKSkgPj0gMCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNoYXIgYXQgcG9zaXRpb24gJyArIHRoaXMucG9zKVxuICAgIH1cblxuICAgIHRoaXMucG9zKytcbiAgICB0aGlzLnJlbWFpbmRlciA9IHRoaXMucmVtYWluZGVyLnN1YmFycmF5KDEpXG4gIH1cblxuICBnZXRBdHRyaWJ1dGVzICgpIHtcbiAgICBpZiAoIXRoaXMucmVtYWluZGVyLmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGVuZCBvZiBpbnB1dCBhdCBwb3NpdGlvbiAnICsgdGhpcy5wb3MpXG4gICAgfVxuXG4gICAgaWYgKHRoaXMucmVtYWluZGVyWzBdID09PSBBU0NJSV9TUEFDRSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIHdoaXRlc3BhY2UgYXQgcG9zaXRpb24gJyArIHRoaXMucG9zKVxuICAgIH1cblxuICAgIHJldHVybiBuZXcgVG9rZW5QYXJzZXIodGhpcywgdGhpcy5wb3MsIHRoaXMucmVtYWluZGVyLnN1YmFycmF5KCksIHRoaXMub3B0aW9ucykuZ2V0QXR0cmlidXRlcygpXG4gIH1cbn1cblxuY2xhc3MgTm9kZSB7XG4gIGNvbnN0cnVjdG9yICh1aW50OEFycmF5LCBwYXJlbnROb2RlLCBzdGFydFBvcykge1xuICAgIHRoaXMudWludDhBcnJheSA9IHVpbnQ4QXJyYXlcbiAgICB0aGlzLmNoaWxkTm9kZXMgPSBbXVxuICAgIHRoaXMudHlwZSA9IGZhbHNlXG4gICAgdGhpcy5jbG9zZWQgPSB0cnVlXG4gICAgdGhpcy52YWx1ZVNraXAgPSBbXVxuICAgIHRoaXMuc3RhcnRQb3MgPSBzdGFydFBvc1xuICAgIHRoaXMudmFsdWVTdGFydCA9IHRoaXMudmFsdWVFbmQgPSB0eXBlb2Ygc3RhcnRQb3MgPT09ICdudW1iZXInID8gc3RhcnRQb3MgKyAxIDogMFxuXG4gICAgaWYgKHBhcmVudE5vZGUpIHtcbiAgICAgIHRoaXMucGFyZW50Tm9kZSA9IHBhcmVudE5vZGVcbiAgICAgIHBhcmVudE5vZGUuY2hpbGROb2Rlcy5wdXNoKHRoaXMpXG4gICAgfVxuICB9XG5cbiAgZ2V0VmFsdWUgKCkge1xuICAgIGxldCB2YWx1ZSA9IGZyb21DaGFyQ29kZSh0aGlzLmdldFZhbHVlQXJyYXkoKSlcbiAgICByZXR1cm4gdGhpcy52YWx1ZVRvVXBwZXJDYXNlID8gdmFsdWUudG9VcHBlckNhc2UoKSA6IHZhbHVlXG4gIH1cblxuICBnZXRWYWx1ZUxlbmd0aCAoKSB7XG4gICAgcmV0dXJuIHRoaXMudmFsdWVFbmQgLSB0aGlzLnZhbHVlU3RhcnQgLSB0aGlzLnZhbHVlU2tpcC5sZW5ndGhcbiAgfVxuXG4gIGdldFZhbHVlQXJyYXkgKCkge1xuICAgIGNvbnN0IHZhbHVlQXJyYXkgPSB0aGlzLnVpbnQ4QXJyYXkuc3ViYXJyYXkodGhpcy52YWx1ZVN0YXJ0LCB0aGlzLnZhbHVlRW5kKVxuXG4gICAgaWYgKHRoaXMudmFsdWVTa2lwLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuIHZhbHVlQXJyYXlcbiAgICB9XG5cbiAgICBsZXQgZmlsdGVyZWRBcnJheSA9IG5ldyBVaW50OEFycmF5KHZhbHVlQXJyYXkubGVuZ3RoIC0gdGhpcy52YWx1ZVNraXAubGVuZ3RoKVxuICAgIGxldCBiZWdpbiA9IDBcbiAgICBsZXQgb2Zmc2V0ID0gMFxuICAgIGxldCBza2lwID0gdGhpcy52YWx1ZVNraXAuc2xpY2UoKVxuXG4gICAgc2tpcC5wdXNoKHZhbHVlQXJyYXkubGVuZ3RoKVxuXG4gICAgc2tpcC5mb3JFYWNoKGZ1bmN0aW9uIChlbmQpIHtcbiAgICAgIGlmIChlbmQgPiBiZWdpbikge1xuICAgICAgICB2YXIgc3ViQXJyYXkgPSB2YWx1ZUFycmF5LnN1YmFycmF5KGJlZ2luLCBlbmQpXG4gICAgICAgIGZpbHRlcmVkQXJyYXkuc2V0KHN1YkFycmF5LCBvZmZzZXQpXG4gICAgICAgIG9mZnNldCArPSBzdWJBcnJheS5sZW5ndGhcbiAgICAgIH1cbiAgICAgIGJlZ2luID0gZW5kICsgMVxuICAgIH0pXG5cbiAgICByZXR1cm4gZmlsdGVyZWRBcnJheVxuICB9XG5cbiAgZXF1YWxzICh2YWx1ZSwgY2FzZVNlbnNpdGl2ZSkge1xuICAgIGlmICh0aGlzLmdldFZhbHVlTGVuZ3RoKCkgIT09IHZhbHVlLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIGZhbHNlXG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuZXF1YWxzQXQodmFsdWUsIDAsIGNhc2VTZW5zaXRpdmUpXG4gIH1cblxuICBlcXVhbHNBdCAodmFsdWUsIGluZGV4LCBjYXNlU2Vuc2l0aXZlKSB7XG4gICAgY2FzZVNlbnNpdGl2ZSA9IHR5cGVvZiBjYXNlU2Vuc2l0aXZlID09PSAnYm9vbGVhbicgPyBjYXNlU2Vuc2l0aXZlIDogdHJ1ZVxuXG4gICAgaWYgKGluZGV4IDwgMCkge1xuICAgICAgaW5kZXggPSB0aGlzLnZhbHVlRW5kICsgaW5kZXhcblxuICAgICAgd2hpbGUgKHRoaXMudmFsdWVTa2lwLmluZGV4T2YodGhpcy52YWx1ZVN0YXJ0ICsgaW5kZXgpID49IDApIHtcbiAgICAgICAgaW5kZXgtLVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpbmRleCA9IHRoaXMudmFsdWVTdGFydCArIGluZGV4XG4gICAgfVxuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgd2hpbGUgKHRoaXMudmFsdWVTa2lwLmluZGV4T2YoaW5kZXggLSB0aGlzLnZhbHVlU3RhcnQpID49IDApIHtcbiAgICAgICAgaW5kZXgrK1xuICAgICAgfVxuXG4gICAgICBpZiAoaW5kZXggPj0gdGhpcy52YWx1ZUVuZCkge1xuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH1cblxuICAgICAgbGV0IHVpbnQ4Q2hhciA9IFN0cmluZy5mcm9tQ2hhckNvZGUodGhpcy51aW50OEFycmF5W2luZGV4XSlcbiAgICAgIGxldCBjaGFyID0gdmFsdWVbaV1cblxuICAgICAgaWYgKCFjYXNlU2Vuc2l0aXZlKSB7XG4gICAgICAgIHVpbnQ4Q2hhciA9IHVpbnQ4Q2hhci50b1VwcGVyQ2FzZSgpXG4gICAgICAgIGNoYXIgPSBjaGFyLnRvVXBwZXJDYXNlKClcbiAgICAgIH1cblxuICAgICAgaWYgKHVpbnQ4Q2hhciAhPT0gY2hhcikge1xuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH1cblxuICAgICAgaW5kZXgrK1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlXG4gIH1cblxuICBpc051bWJlciAoKSB7XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnZhbHVlRW5kIC0gdGhpcy52YWx1ZVN0YXJ0OyBpKyspIHtcbiAgICAgIGlmICh0aGlzLnZhbHVlU2tpcC5pbmRleE9mKGkpID49IDApIHtcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgaWYgKCF0aGlzLmlzRGlnaXQoaSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlXG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRydWVcbiAgfVxuXG4gIGlzRGlnaXQgKGluZGV4KSB7XG4gICAgaWYgKGluZGV4IDwgMCkge1xuICAgICAgaW5kZXggPSB0aGlzLnZhbHVlRW5kICsgaW5kZXhcblxuICAgICAgd2hpbGUgKHRoaXMudmFsdWVTa2lwLmluZGV4T2YodGhpcy52YWx1ZVN0YXJ0ICsgaW5kZXgpID49IDApIHtcbiAgICAgICAgaW5kZXgtLVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpbmRleCA9IHRoaXMudmFsdWVTdGFydCArIGluZGV4XG5cbiAgICAgIHdoaWxlICh0aGlzLnZhbHVlU2tpcC5pbmRleE9mKHRoaXMudmFsdWVTdGFydCArIGluZGV4KSA+PSAwKSB7XG4gICAgICAgIGluZGV4KytcbiAgICAgIH1cbiAgICB9XG5cbiAgICBsZXQgYXNjaWkgPSB0aGlzLnVpbnQ4QXJyYXlbaW5kZXhdXG4gICAgcmV0dXJuIGFzY2lpID49IDQ4ICYmIGFzY2lpIDw9IDU3XG4gIH1cblxuICBjb250YWluc0NoYXIgKGNoYXIpIHtcbiAgICBsZXQgYXNjaWkgPSBjaGFyLmNoYXJDb2RlQXQoMClcblxuICAgIGZvciAobGV0IGkgPSB0aGlzLnZhbHVlU3RhcnQ7IGkgPCB0aGlzLnZhbHVlRW5kOyBpKyspIHtcbiAgICAgIGlmICh0aGlzLnZhbHVlU2tpcC5pbmRleE9mKGkgLSB0aGlzLnZhbHVlU3RhcnQpID49IDApIHtcbiAgICAgICAgY29udGludWVcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMudWludDhBcnJheVtpXSA9PT0gYXNjaWkpIHtcbiAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2VcbiAgfVxufVxuXG5jbGFzcyBUb2tlblBhcnNlciB7XG4gIGNvbnN0cnVjdG9yIChwYXJlbnQsIHN0YXJ0UG9zLCB1aW50OEFycmF5LCBvcHRpb25zID0ge30pIHtcbiAgICB0aGlzLnVpbnQ4QXJyYXkgPSB1aW50OEFycmF5XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9uc1xuICAgIHRoaXMucGFyZW50ID0gcGFyZW50XG5cbiAgICB0aGlzLnRyZWUgPSB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKClcbiAgICB0aGlzLnBvcyA9IHN0YXJ0UG9zIHx8IDBcblxuICAgIHRoaXMuY3VycmVudE5vZGUudHlwZSA9ICdUUkVFJ1xuXG4gICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG5cbiAgICBpZiAodGhpcy5vcHRpb25zLnZhbHVlQXNTdHJpbmcgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5vcHRpb25zLnZhbHVlQXNTdHJpbmcgPSB0cnVlXG4gICAgfVxuXG4gICAgdGhpcy5wcm9jZXNzU3RyaW5nKClcbiAgfVxuXG4gIGdldEF0dHJpYnV0ZXMgKCkge1xuICAgIGxldCBhdHRyaWJ1dGVzID0gW11cbiAgICBsZXQgYnJhbmNoID0gYXR0cmlidXRlc1xuXG4gICAgbGV0IHdhbGsgPSBub2RlID0+IHtcbiAgICAgIGxldCBlbG1cbiAgICAgIGxldCBjdXJCcmFuY2ggPSBicmFuY2hcbiAgICAgIGxldCBwYXJ0aWFsXG5cbiAgICAgIGlmICghbm9kZS5jbG9zZWQgJiYgbm9kZS50eXBlID09PSAnU0VRVUVOQ0UnICYmIG5vZGUuZXF1YWxzKCcqJykpIHtcbiAgICAgICAgbm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgIG5vZGUudHlwZSA9ICdBVE9NJ1xuICAgICAgfVxuXG4gICAgICAvLyBJZiB0aGUgbm9kZSB3YXMgbmV2ZXIgY2xvc2VkLCB0aHJvdyBpdFxuICAgICAgaWYgKCFub2RlLmNsb3NlZCkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgZW5kIG9mIGlucHV0IGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyB0aGlzLnVpbnQ4QXJyYXkubGVuZ3RoIC0gMSkpXG4gICAgICB9XG5cbiAgICAgIHN3aXRjaCAobm9kZS50eXBlLnRvVXBwZXJDYXNlKCkpIHtcbiAgICAgICAgY2FzZSAnTElURVJBTCc6XG4gICAgICAgIGNhc2UgJ1NUUklORyc6XG4gICAgICAgICAgZWxtID0ge1xuICAgICAgICAgICAgdHlwZTogbm9kZS50eXBlLnRvVXBwZXJDYXNlKCksXG4gICAgICAgICAgICB2YWx1ZTogdGhpcy5vcHRpb25zLnZhbHVlQXNTdHJpbmcgPyBub2RlLmdldFZhbHVlKCkgOiBub2RlLmdldFZhbHVlQXJyYXkoKVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmFuY2gucHVzaChlbG0pXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAnU0VRVUVOQ0UnOlxuICAgICAgICAgIGVsbSA9IHtcbiAgICAgICAgICAgIHR5cGU6IG5vZGUudHlwZS50b1VwcGVyQ2FzZSgpLFxuICAgICAgICAgICAgdmFsdWU6IG5vZGUuZ2V0VmFsdWUoKVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmFuY2gucHVzaChlbG0pXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAnQVRPTSc6XG4gICAgICAgICAgaWYgKG5vZGUuZXF1YWxzKCdOSUwnLCB0cnVlKSkge1xuICAgICAgICAgICAgYnJhbmNoLnB1c2gobnVsbClcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgfVxuICAgICAgICAgIGVsbSA9IHtcbiAgICAgICAgICAgIHR5cGU6IG5vZGUudHlwZS50b1VwcGVyQ2FzZSgpLFxuICAgICAgICAgICAgdmFsdWU6IG5vZGUuZ2V0VmFsdWUoKVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmFuY2gucHVzaChlbG0pXG4gICAgICAgICAgYnJlYWtcbiAgICAgICAgY2FzZSAnU0VDVElPTic6XG4gICAgICAgICAgYnJhbmNoID0gYnJhbmNoW2JyYW5jaC5sZW5ndGggLSAxXS5zZWN0aW9uID0gW11cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlICdMSVNUJzpcbiAgICAgICAgICBlbG0gPSBbXVxuICAgICAgICAgIGJyYW5jaC5wdXNoKGVsbSlcbiAgICAgICAgICBicmFuY2ggPSBlbG1cbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlICdQQVJUSUFMJzpcbiAgICAgICAgICBwYXJ0aWFsID0gbm9kZS5nZXRWYWx1ZSgpLnNwbGl0KCcuJykubWFwKE51bWJlcilcbiAgICAgICAgICBicmFuY2hbYnJhbmNoLmxlbmd0aCAtIDFdLnBhcnRpYWwgPSBwYXJ0aWFsXG4gICAgICAgICAgYnJlYWtcbiAgICAgIH1cblxuICAgICAgbm9kZS5jaGlsZE5vZGVzLmZvckVhY2goZnVuY3Rpb24gKGNoaWxkTm9kZSkge1xuICAgICAgICB3YWxrKGNoaWxkTm9kZSlcbiAgICAgIH0pXG4gICAgICBicmFuY2ggPSBjdXJCcmFuY2hcbiAgICB9XG5cbiAgICB3YWxrKHRoaXMudHJlZSlcblxuICAgIHJldHVybiBhdHRyaWJ1dGVzXG4gIH1cblxuICBjcmVhdGVOb2RlIChwYXJlbnROb2RlLCBzdGFydFBvcykge1xuICAgIHJldHVybiBuZXcgTm9kZSh0aGlzLnVpbnQ4QXJyYXksIHBhcmVudE5vZGUsIHN0YXJ0UG9zKVxuICB9XG5cbiAgcHJvY2Vzc1N0cmluZyAoKSB7XG4gICAgbGV0IGlcbiAgICBsZXQgbGVuXG4gICAgY29uc3QgY2hlY2tTUCA9IChwb3MpID0+IHtcbiAgICAgIC8vIGp1bXAgdG8gdGhlIG5leHQgbm9uIHdoaXRlc3BhY2UgcG9zXG4gICAgICB3aGlsZSAodGhpcy51aW50OEFycmF5W2kgKyAxXSA9PT0gJyAnKSB7XG4gICAgICAgIGkrK1xuICAgICAgfVxuICAgIH1cblxuICAgIGZvciAoaSA9IDAsIGxlbiA9IHRoaXMudWludDhBcnJheS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgbGV0IGNociA9IFN0cmluZy5mcm9tQ2hhckNvZGUodGhpcy51aW50OEFycmF5W2ldKVxuXG4gICAgICBzd2l0Y2ggKHRoaXMuc3RhdGUpIHtcbiAgICAgICAgY2FzZSAnTk9STUFMJzpcblxuICAgICAgICAgIHN3aXRjaCAoY2hyKSB7XG4gICAgICAgICAgICAvLyBEUVVPVEUgc3RhcnRzIGEgbmV3IHN0cmluZ1xuICAgICAgICAgICAgY2FzZSAnXCInOlxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKHRoaXMuY3VycmVudE5vZGUsIGkpXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudHlwZSA9ICdzdHJpbmcnXG4gICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnU1RSSU5HJ1xuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IGZhbHNlXG4gICAgICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgICAgIC8vICggc3RhcnRzIGEgbmV3IGxpc3RcbiAgICAgICAgICAgIGNhc2UgJygnOlxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKHRoaXMuY3VycmVudE5vZGUsIGkpXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudHlwZSA9ICdMSVNUJ1xuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IGZhbHNlXG4gICAgICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgICAgIC8vICkgY2xvc2VzIGEgbGlzdFxuICAgICAgICAgICAgY2FzZSAnKSc6XG4gICAgICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnROb2RlLnR5cGUgIT09ICdMSVNUJykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBsaXN0IHRlcm1pbmF0b3IgKSBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuXG4gICAgICAgICAgICAgIGNoZWNrU1AoKVxuICAgICAgICAgICAgICBicmVha1xuXG4gICAgICAgICAgICAvLyBdIGNsb3NlcyBzZWN0aW9uIGdyb3VwXG4gICAgICAgICAgICBjYXNlICddJzpcbiAgICAgICAgICAgICAgaWYgKHRoaXMuY3VycmVudE5vZGUudHlwZSAhPT0gJ1NFQ1RJT04nKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIHNlY3Rpb24gdGVybWluYXRvciBdIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgICBjaGVja1NQKClcbiAgICAgICAgICAgICAgYnJlYWtcblxuICAgICAgICAgICAgLy8gPCBzdGFydHMgYSBuZXcgcGFydGlhbFxuICAgICAgICAgICAgY2FzZSAnPCc6XG4gICAgICAgICAgICAgIGlmIChTdHJpbmcuZnJvbUNoYXJDb2RlKHRoaXMudWludDhBcnJheVtpIC0gMV0pICE9PSAnXScpIHtcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKHRoaXMuY3VycmVudE5vZGUsIGkpXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ0FUT00nXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZVN0YXJ0ID0gaVxuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpICsgMVxuICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnQVRPTSdcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKHRoaXMuY3VycmVudE5vZGUsIGkpXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ1BBUlRJQUwnXG4gICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdQQVJUSUFMJ1xuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gZmFsc2VcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBicmVha1xuXG4gICAgICAgICAgICAvLyB7IHN0YXJ0cyBhIG5ldyBsaXRlcmFsXG4gICAgICAgICAgICBjYXNlICd7JzpcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSh0aGlzLmN1cnJlbnROb2RlLCBpKVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnTElURVJBTCdcbiAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdMSVRFUkFMJ1xuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IGZhbHNlXG4gICAgICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgICAgIC8vICggc3RhcnRzIGEgbmV3IHNlcXVlbmNlXG4gICAgICAgICAgICBjYXNlICcqJzpcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3JlYXRlTm9kZSh0aGlzLmN1cnJlbnROb2RlLCBpKVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnU0VRVUVOQ0UnXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVTdGFydCA9IGlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IGkgKyAxXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gZmFsc2VcbiAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdTRVFVRU5DRSdcbiAgICAgICAgICAgICAgYnJlYWtcblxuICAgICAgICAgICAgLy8gbm9ybWFsbHkgYSBzcGFjZSBzaG91bGQgbmV2ZXIgb2NjdXJcbiAgICAgICAgICAgIGNhc2UgJyAnOlxuICAgICAgICAgICAgICAvLyBqdXN0IGlnbm9yZVxuICAgICAgICAgICAgICBicmVha1xuXG4gICAgICAgICAgICAvLyBbIHN0YXJ0cyBzZWN0aW9uXG4gICAgICAgICAgICBjYXNlICdbJzpcbiAgICAgICAgICAgICAgLy8gSWYgaXQgaXMgdGhlICpmaXJzdCogZWxlbWVudCBhZnRlciByZXNwb25zZSBjb21tYW5kLCB0aGVuIHByb2Nlc3MgYXMgYSByZXNwb25zZSBhcmd1bWVudCBsaXN0XG4gICAgICAgICAgICAgIGlmIChbJ09LJywgJ05PJywgJ0JBRCcsICdCWUUnLCAnUFJFQVVUSCddLmluZGV4T2YodGhpcy5wYXJlbnQuY29tbWFuZC50b1VwcGVyQ2FzZSgpKSA+PSAwICYmIHRoaXMuY3VycmVudE5vZGUgPT09IHRoaXMudHJlZSkge1xuICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpXG5cbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKHRoaXMuY3VycmVudE5vZGUsIGkpXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ0FUT00nXG5cbiAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jcmVhdGVOb2RlKHRoaXMuY3VycmVudE5vZGUsIGkpXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ1NFQ1RJT04nXG4gICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSBmYWxzZVxuICAgICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnTk9STUFMJ1xuXG4gICAgICAgICAgICAgICAgLy8gUkZDMjIyMSBkZWZpbmVzIGEgcmVzcG9uc2UgY29kZSBSRUZFUlJBTCB3aG9zZSBwYXlsb2FkIGlzIGFuXG4gICAgICAgICAgICAgICAgLy8gUkZDMjE5Mi9SRkM1MDkyIGltYXB1cmwgdGhhdCB3ZSB3aWxsIHRyeSB0byBwYXJzZSBhcyBhbiBBVE9NIGJ1dFxuICAgICAgICAgICAgICAgIC8vIGZhaWwgcXVpdGUgYmFkbHkgYXQgcGFyc2luZy4gIFNpbmNlIHRoZSBpbWFwdXJsIGlzIHN1Y2ggYSB1bmlxdWVcbiAgICAgICAgICAgICAgICAvLyAoYW5kIGNyYXp5KSB0ZXJtLCB3ZSBqdXN0IHNwZWNpYWxpemUgdGhhdCBjYXNlIGhlcmUuXG4gICAgICAgICAgICAgICAgaWYgKGZyb21DaGFyQ29kZSh0aGlzLnVpbnQ4QXJyYXkuc3ViYXJyYXkoaSArIDEsIGkgKyAxMCkpLnRvVXBwZXJDYXNlKCkgPT09ICdSRUZFUlJBTCAnKSB7XG4gICAgICAgICAgICAgICAgICAvLyBjcmVhdGUgdGhlIFJFRkVSUkFMIGF0b21cbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgdGhpcy5wb3MgKyBpICsgMSlcbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudHlwZSA9ICdBVE9NJ1xuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGkgKyA4XG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlU3RhcnQgPSBpICsgMVxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IGkgKyA5XG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlVG9VcHBlckNhc2UgPSB0cnVlXG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG5cbiAgICAgICAgICAgICAgICAgIC8vIGVhdCBhbGwgdGhlIHdheSB0aHJvdWdoIHRoZSBdIHRvIGJlIHRoZSAgSU1BUFVSTCB0b2tlbi5cbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgdGhpcy5wb3MgKyBpICsgMTApXG4gICAgICAgICAgICAgICAgICAvLyBqdXN0IGNhbGwgdGhpcyBhbiBBVE9NLCBldmVuIHRob3VnaCBJTUFQVVJMIG1pZ2h0IGJlIG1vcmUgY29ycmVjdFxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ0FUT00nXG4gICAgICAgICAgICAgICAgICAvLyBqdW1wIGkgdG8gdGhlICddJ1xuICAgICAgICAgICAgICAgICAgaSA9IHRoaXMudWludDhBcnJheS5pbmRleE9mKEFTQ0lJX1JJR0hUX0JSQUNLRVQsIGkgKyAxMClcbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpIC0gMVxuICAgICAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZVN0YXJ0ID0gdGhpcy5jdXJyZW50Tm9kZS5zdGFydFBvcyAtIHRoaXMucG9zXG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlRW5kID0gdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgLSB0aGlzLnBvcyArIDFcbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcblxuICAgICAgICAgICAgICAgICAgLy8gY2xvc2Ugb3V0IHRoZSBTRUNUSU9OXG4gICAgICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcbiAgICAgICAgICAgICAgICAgIGNoZWNrU1AoKVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8qIGZhbGxzIHRocm91Z2ggKi9cbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgIC8vIEFueSBBVE9NIHN1cHBvcnRlZCBjaGFyIHN0YXJ0cyBhIG5ldyBBdG9tIHNlcXVlbmNlLCBvdGhlcndpc2UgdGhyb3cgYW4gZXJyb3JcbiAgICAgICAgICAgICAgLy8gQWxsb3cgXFwgYXMgdGhlIGZpcnN0IGNoYXIgZm9yIGF0b20gdG8gc3VwcG9ydCBzeXN0ZW0gZmxhZ3NcbiAgICAgICAgICAgICAgLy8gQWxsb3cgJSB0byBzdXBwb3J0IExJU1QgJycgJVxuICAgICAgICAgICAgICBpZiAoQVRPTV9DSEFSKCkuaW5kZXhPZihjaHIpIDwgMCAmJiBjaHIgIT09ICdcXFxcJyAmJiBjaHIgIT09ICclJykge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBjaGFyIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZSwgaSlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ0FUT00nXG4gICAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVTdGFydCA9IGlcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IGkgKyAxXG4gICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnQVRPTSdcbiAgICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWtcblxuICAgICAgICBjYXNlICdBVE9NJzpcblxuICAgICAgICAgIC8vIHNwYWNlIGZpbmlzaGVzIGFuIGF0b21cbiAgICAgICAgICBpZiAoY2hyID09PSAnICcpIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpIC0gMVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9ICdOT1JNQUwnXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vXG4gICAgICAgICAgaWYgKFxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlICYmXG4gICAgICAgICAgICAoXG4gICAgICAgICAgICAgIChjaHIgPT09ICcpJyAmJiB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGUudHlwZSA9PT0gJ0xJU1QnKSB8fFxuICAgICAgICAgICAgICAoY2hyID09PSAnXScgJiYgdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlLnR5cGUgPT09ICdTRUNUSU9OJylcbiAgICAgICAgICAgIClcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpIC0gMVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcblxuICAgICAgICAgICAgY2hlY2tTUCgpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICgoY2hyID09PSAnLCcgfHwgY2hyID09PSAnOicpICYmIHRoaXMuY3VycmVudE5vZGUuaXNOdW1iZXIoKSkge1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS50eXBlID0gJ1NFUVVFTkNFJ1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gJ1NFUVVFTkNFJ1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFsgc3RhcnRzIGEgc2VjdGlvbiBncm91cCBmb3IgdGhpcyBlbGVtZW50XG4gICAgICAgICAgaWYgKGNociA9PT0gJ1snICYmICh0aGlzLmN1cnJlbnROb2RlLmVxdWFscygnQk9EWScsIGZhbHNlKSB8fCB0aGlzLmN1cnJlbnROb2RlLmVxdWFscygnQk9EWS5QRUVLJywgZmFsc2UpKSkge1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5lbmRQb3MgPSB0aGlzLnBvcyArIGlcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmNyZWF0ZU5vZGUodGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlLCB0aGlzLnBvcyArIGkpXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnR5cGUgPSAnU0VDVElPTidcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuY2xvc2VkID0gZmFsc2VcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnTk9STUFMJ1xuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY2hyID09PSAnPCcpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBzdGFydCBvZiBwYXJ0aWFsIGF0IHBvc2l0aW9uICcgKyB0aGlzLnBvcylcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBpZiB0aGUgY2hhciBpcyBub3QgQVRPTSBjb21wYXRpYmxlIG9yIG5vdCBxdW90ZWQsIHRocm93LiBBbGxvdyBcXCogYXMgYW4gZXhjZXB0aW9uXG4gICAgICAgICAgaWYgKEFUT01fQ0hBUigpLmluZGV4T2YoY2hyKSA8IDAgJiYgRFFVT1RFKCkuaW5kZXhPZihjaHIpIDwgMCAmJiBjaHIgIT09ICddJyAmJiAhKGNociA9PT0gJyonICYmIHRoaXMuY3VycmVudE5vZGUuZXF1YWxzKCdcXFxcJykpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgfSBlbHNlIGlmICh0aGlzLmN1cnJlbnROb2RlLmVxdWFscygnXFxcXConKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNoYXIgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpICsgMVxuICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgY2FzZSAnU1RSSU5HJzpcblxuICAgICAgICAgIC8vIERRVU9URSBlbmRzIHRoZSBzdHJpbmcgc2VxdWVuY2VcbiAgICAgICAgICBpZiAoY2hyID09PSAnXCInKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcblxuICAgICAgICAgICAgY2hlY2tTUCgpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cblxuICAgICAgICAgIC8vIFxcIEVzY2FwZXMgdGhlIGZvbGxvd2luZyBjaGFyXG4gICAgICAgICAgaWYgKGNociA9PT0gJ1xcXFwnKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlU2tpcC5wdXNoKGkgLSB0aGlzLmN1cnJlbnROb2RlLnZhbHVlU3RhcnQpXG4gICAgICAgICAgICBpKytcbiAgICAgICAgICAgIGlmIChpID49IGxlbikge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgZW5kIG9mIGlucHV0IGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNociA9IFN0cmluZy5mcm9tQ2hhckNvZGUodGhpcy51aW50OEFycmF5W2ldKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIC8qIC8vIHNraXAgdGhpcyBjaGVjaywgb3RoZXJ3aXNlIHRoZSBwYXJzZXIgbWlnaHQgZXhwbG9kZSBvbiBiaW5hcnkgaW5wdXRcbiAgICAgICAgICBpZiAoVEVYVF9DSEFSKCkuaW5kZXhPZihjaHIpIDwgMCkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICAqL1xuXG4gICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IGkgKyAxXG4gICAgICAgICAgYnJlYWtcblxuICAgICAgICBjYXNlICdQQVJUSUFMJzpcbiAgICAgICAgICBpZiAoY2hyID09PSAnPicpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcuJywgLTEpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBlbmQgb2YgcGFydGlhbCBhdCBwb3NpdGlvbiAnICsgdGhpcy5wb3MpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcbiAgICAgICAgICAgIGNoZWNrU1AoKVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoY2hyID09PSAnLicgJiYgKCF0aGlzLmN1cnJlbnROb2RlLmdldFZhbHVlTGVuZ3RoKCkgfHwgdGhpcy5jdXJyZW50Tm9kZS5jb250YWluc0NoYXIoJy4nKSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBwYXJ0aWFsIHNlcGFyYXRvciAuIGF0IHBvc2l0aW9uICcgKyB0aGlzLnBvcylcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAoRElHSVQoKS5pbmRleE9mKGNocikgPCAwICYmIGNociAhPT0gJy4nKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKGNociAhPT0gJy4nICYmICh0aGlzLmN1cnJlbnROb2RlLmVxdWFscygnMCcpIHx8IHRoaXMuY3VycmVudE5vZGUuZXF1YWxzQXQoJy4wJywgLTIpKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHBhcnRpYWwgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpICsgMVxuICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgY2FzZSAnTElURVJBTCc6XG4gICAgICAgICAgaWYgKHRoaXMuY3VycmVudE5vZGUuc3RhcnRlZCkge1xuICAgICAgICAgICAgaWYgKGNociA9PT0gJ1xcdTAwMDAnKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBcXFxceDAwIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUudmFsdWVFbmQgPSBpICsgMVxuXG4gICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Tm9kZS5nZXRWYWx1ZUxlbmd0aCgpID49IHRoaXMuY3VycmVudE5vZGUubGl0ZXJhbExlbmd0aCkge1xuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcbiAgICAgICAgICAgICAgY2hlY2tTUCgpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjaHIgPT09ICcrJyAmJiB0aGlzLm9wdGlvbnMubGl0ZXJhbFBsdXMpIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUubGl0ZXJhbFBsdXMgPSB0cnVlXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjaHIgPT09ICd9Jykge1xuICAgICAgICAgICAgaWYgKCEoJ2xpdGVyYWxMZW5ndGgnIGluIHRoaXMuY3VycmVudE5vZGUpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBsaXRlcmFsIHByZWZpeCBlbmQgY2hhciB9IGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0aGlzLnVpbnQ4QXJyYXlbaSArIDFdID09PSBBU0NJSV9OTCkge1xuICAgICAgICAgICAgICBpKytcbiAgICAgICAgICAgIH0gZWxzZSBpZiAodGhpcy51aW50OEFycmF5W2kgKyAxXSA9PT0gQVNDSUlfQ1IgJiYgdGhpcy51aW50OEFycmF5W2kgKyAyXSA9PT0gQVNDSUlfTkwpIHtcbiAgICAgICAgICAgICAgaSArPSAyXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLnZhbHVlU3RhcnQgPSBpICsgMVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5saXRlcmFsTGVuZ3RoID0gTnVtYmVyKHRoaXMuY3VycmVudE5vZGUubGl0ZXJhbExlbmd0aClcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuc3RhcnRlZCA9IHRydWVcblxuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnROb2RlLmxpdGVyYWxMZW5ndGgpIHtcbiAgICAgICAgICAgICAgLy8gc3BlY2lhbCBjYXNlIHdoZXJlIGxpdGVyYWwgY29udGVudCBsZW5ndGggaXMgMFxuICAgICAgICAgICAgICAvLyBjbG9zZSB0aGUgbm9kZSByaWdodCBhd2F5LCBkbyBub3Qgd2FpdCBmb3IgYWRkaXRpb25hbCBpbnB1dFxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaVxuICAgICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuICAgICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcbiAgICAgICAgICAgICAgY2hlY2tTUCgpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoRElHSVQoKS5pbmRleE9mKGNocikgPCAwKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnROb2RlLmxpdGVyYWxMZW5ndGggPT09ICcwJykge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGxpdGVyYWwgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgIH1cbiAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmxpdGVyYWxMZW5ndGggPSAodGhpcy5jdXJyZW50Tm9kZS5saXRlcmFsTGVuZ3RoIHx8ICcnKSArIGNoclxuICAgICAgICAgIGJyZWFrXG5cbiAgICAgICAgY2FzZSAnU0VRVUVOQ0UnOlxuICAgICAgICAgIC8vIHNwYWNlIGZpbmlzaGVzIHRoZSBzZXF1ZW5jZSBzZXRcbiAgICAgICAgICBpZiAoY2hyID09PSAnICcpIHtcbiAgICAgICAgICAgIGlmICghdGhpcy5jdXJyZW50Tm9kZS5pc0RpZ2l0KC0xKSAmJiAhdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnKicsIC0xKSkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgd2hpdGVzcGFjZSBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcqJywgLTEpICYmICF0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCc6JywgLTIpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCB3aGl0ZXNwYWNlIGF0IHBvc2l0aW9uICcgKyAodGhpcy5wb3MgKyBpKSlcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS5jbG9zZWQgPSB0cnVlXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmVuZFBvcyA9IHRoaXMucG9zICsgaSAtIDFcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUgPSB0aGlzLmN1cnJlbnROb2RlLnBhcmVudE5vZGVcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSAnTk9STUFMJ1xuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICB9IGVsc2UgaWYgKHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZSAmJlxuICAgICAgICAgICAgY2hyID09PSAnXScgJiZcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZS50eXBlID09PSAnU0VDVElPTicpIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpIC0gMVxuICAgICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZSA9IHRoaXMuY3VycmVudE5vZGUucGFyZW50Tm9kZVxuXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlLmNsb3NlZCA9IHRydWVcbiAgICAgICAgICAgIHRoaXMuY3VycmVudE5vZGUuZW5kUG9zID0gdGhpcy5wb3MgKyBpXG4gICAgICAgICAgICB0aGlzLmN1cnJlbnROb2RlID0gdGhpcy5jdXJyZW50Tm9kZS5wYXJlbnROb2RlXG4gICAgICAgICAgICB0aGlzLnN0YXRlID0gJ05PUk1BTCdcblxuICAgICAgICAgICAgY2hlY2tTUCgpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmIChjaHIgPT09ICc6Jykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnROb2RlLmlzRGlnaXQoLTEpICYmICF0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcqJywgLTEpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCByYW5nZSBzZXBhcmF0b3IgOiBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChjaHIgPT09ICcqJykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcsJywgLTEpICYmICF0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCc6JywgLTEpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCByYW5nZSB3aWxkY2FyZCBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIGlmIChjaHIgPT09ICcsJykge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmN1cnJlbnROb2RlLmlzRGlnaXQoLTEpICYmICF0aGlzLmN1cnJlbnROb2RlLmVxdWFsc0F0KCcqJywgLTEpKSB7XG4gICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBzZXF1ZW5jZSBzZXBhcmF0b3IgLCBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnKicsIC0xKSAmJiAhdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnOicsIC0yKSkge1xuICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgc2VxdWVuY2Ugc2VwYXJhdG9yICwgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSBpZiAoIS9cXGQvLnRlc3QoY2hyKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGNoYXIgYXQgcG9zaXRpb24gJyArICh0aGlzLnBvcyArIGkpKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGlmICgvXFxkLy50ZXN0KGNocikgJiYgdGhpcy5jdXJyZW50Tm9kZS5lcXVhbHNBdCgnKicsIC0xKSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIG51bWJlciBhdCBwb3NpdGlvbiAnICsgKHRoaXMucG9zICsgaSkpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdGhpcy5jdXJyZW50Tm9kZS52YWx1ZUVuZCA9IGkgKyAxXG4gICAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gKGJ1ZmZlcnMsIG9wdGlvbnMgPSB7fSkge1xuICBsZXQgcGFyc2VyID0gbmV3IFBhcnNlckluc3RhbmNlKGJ1ZmZlcnMsIG9wdGlvbnMpXG4gIGxldCByZXNwb25zZSA9IHt9XG5cbiAgcmVzcG9uc2UudGFnID0gcGFyc2VyLmdldFRhZygpXG4gIHBhcnNlci5nZXRTcGFjZSgpXG4gIHJlc3BvbnNlLmNvbW1hbmQgPSBwYXJzZXIuZ2V0Q29tbWFuZCgpXG5cbiAgaWYgKFsnVUlEJywgJ0FVVEhFTlRJQ0FURSddLmluZGV4T2YoKHJlc3BvbnNlLmNvbW1hbmQgfHwgJycpLnRvVXBwZXJDYXNlKCkpID49IDApIHtcbiAgICBwYXJzZXIuZ2V0U3BhY2UoKVxuICAgIHJlc3BvbnNlLmNvbW1hbmQgKz0gJyAnICsgcGFyc2VyLmdldEVsZW1lbnQoQ09NTUFORCgpKVxuICB9XG5cbiAgaWYgKCFpc0VtcHR5KHBhcnNlci5yZW1haW5kZXIpKSB7XG4gICAgcGFyc2VyLmdldFNwYWNlKClcbiAgICByZXNwb25zZS5hdHRyaWJ1dGVzID0gcGFyc2VyLmdldEF0dHJpYnV0ZXMoKVxuICB9XG5cbiAgaWYgKHBhcnNlci5odW1hblJlYWRhYmxlKSB7XG4gICAgcmVzcG9uc2UuYXR0cmlidXRlcyA9IChyZXNwb25zZS5hdHRyaWJ1dGVzIHx8IFtdKS5jb25jYXQoe1xuICAgICAgdHlwZTogJ1RFWFQnLFxuICAgICAgdmFsdWU6IHBhcnNlci5odW1hblJlYWRhYmxlXG4gICAgfSlcbiAgfVxuXG4gIHJldHVybiByZXNwb25zZVxufVxuIl19