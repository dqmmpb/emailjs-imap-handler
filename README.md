# IMAP Handler

Parses and compiles IMAP commands.

## Install

Install with [bower](http://bower.io)

    bower install imapHandler

Require *bower_components/imapHandler/imapHandler.js* as an AMD module or include the following files in your page:

  * *bower_components/imapHandler/imapFormalSyntax.js*
  * *bower_components/imapHandler/imapParser.js*
  * *bower_components/imapHandler/imapCompiler.js*
  * *bower_components/imapHandler/imapHandler.js*

## Usage

### Parse IMAP commands

To parse a command you need to have the command as one complete string (including all literals) without the ending &lt;CR&gt;&lt;LF&gt;

    imapHandler.parser(imapCommand[, options]);

Where

  * **imapCommand** is an IMAP string without the final line break
  * **options** is an optional options object (see below)

Options

  * **allowUntagged** (Boolean) by default parsing "*" tags are not allowed, set this value to true to accept untagged commands. If you're building a client, you most certainly want to set it to true.
  * **allowSection** (Array) Not all atoms are allowed to have section (and partial) values, set the command names with this array (default value is `["BODY", "BODY.PEEK"]`)

The function returns an object in the following form:

```
{
    tag: "TAG",
    command: "COMMAND",
    attributes: [
        {type: "SEQUENCE", value: "sequence-set"},
        {type: "ATOM", value: "atom", section:[section_elements], partial: [start, end]},
        {type: "STRING", value: "string"},
        {type: "LITERAL", value: "literal"},
        [list_elements]
    ]
}
```

Where

  * **tag** is a string containing the tag
  * **command** is the first element after tag
  * **attributes** (if present) is an array of next elements

If section or partial values are not specified in the command, the values are also missing from the ATOM element

**NB!** Sequence numbers are identified as ATOM values if the value contains only numbers.
**NB!** NIL atoms are always identified as `null` values, even though in some cases it might be an ATOM with value `"NIL"`

For example

```javascript
var imapHandler = require("imap-handler");

imapHandler.parser("A1 FETCH *:4 (BODY[HEADER.FIELDS ({4}\r\nDate Subject)]<12.45> UID)");
```

Results in the following value:

```json
{
    "tag": "A1",
    "command": "FETCH",
    "attributes": [
        [
            {
                "type": "SEQUENCE",
                "value": "*:4"
            },
            {
                "type": "ATOM",
                "value": "BODY",
                "section": [
                    {
                        "type": "ATOM",
                        "value": "HEADER.FIELDS"
                    },
                    [
                        {
                            "type": "LITERAL",
                            "value": "Date"
                        },
                        {
                            "type": "ATOM",
                            "value": "Subject"
                        }
                    ]
                ],
                "partial": [
                    12,
                    45
                ]
            },
            {
                "type": "ATOM",
                "value": "UID"
            }
        ]
    ]
}
```

### Compile command objects into IMAP commands

You can "compile" parsed or self generated IMAP command obejcts to IMAP command strings with

    imapHandler.compiler(commandObject);

Where

  * **commandObject** is an object parsed with `imapHandler.parser()` or self generated

The function returns a string.

The input object differs from the parsed object with the following aspects:

  * **string**, **number** and **null** (null values are all non-number and non-string falsy values) are allowed to use directly - `{type: "STRING", value: "hello"}` can be replaced with `"hello"`
  * Additional types are used: `SECTION` which is an alias for `ATOM` and `TEXT` which returns the input string as given with no modification (useful for server messages).

For example

```javascript
var command = {
    tag: "*",
    command: "OK",
    attributes: [
        {
            type: "SECTION",
            section: [
                {type: "ATOM", value: "ALERT"}
            ]
        },
        {type:"TEXT", value: "NB! The server is shutting down"}
    ]
};

imapHandler.compiler(command);
// * OK [ALERT] NB! The server is shutting down
```

## License

**MIT**
