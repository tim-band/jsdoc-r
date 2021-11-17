const env = require('jsdoc/env');
const fs = require('jsdoc/fs');
const helper = require('jsdoc/util/templateHelper');
const path = require('jsdoc/path');
const taffy = require('taffydb').taffy;
const template = require('jsdoc/template');

let data;
let view;

let outdir = path.normalize(env.opts.destination);

function hashToLink(doclet, hash) {
    let url;

    if ( !/^(#.+)/.test(hash) ) {
        return hash;
    }

    url = helper.createLink(doclet);
    url = url.replace(/(#.+|$)/, hash);

    return `<a href="${url}">${hash}</a>`;
}

function getPathFromDoclet({meta}) {
    if (!meta) {
        return null;
    }

    return meta.path && meta.path !== 'null' ?
        path.join(meta.path, meta.filename) :
        meta.filename;
}

function linkifyRd(rd) {
    let out = '';
    let pieces = rd.split(/(?:\[([^\]]+)\])?{@link(code|plain|)\s+([^| \t}]*)(?:[| \t]([^}]*))?}/);
    for(;;) {
        const text = pieces.shift();
        if (typeof(text) === 'undefined') {
            return out;
        }
        out += text;
        let linkText = pieces.shift();
        if (typeof(linkText) === 'undefined') {
            linkText = '';
        }
        const linkType = pieces.shift();
        if (typeof(linkType) === 'undefined') {
            return out;
        }
        let start = '\\link';
        let end = '';
        if (linkType !== 'plain') {
            start = '\\code{' + start;
            end = end + '}';
        }
        const target = pieces.shift();
        if (typeof(target) === 'undefined') {
            return out;
        }
        const linkText2 = pieces.shift();
        if (typeof(linkText2) !== 'undefined') {
            if (linkText) {
                console.error('Link text defined twice: ' + linkText + ' and ' + linkText2);
            }
            linkText = linkText2;
        }
        if (linkText) {
            start += '[=' + linkText + ']';
        }
        if (target.match(/^\s*[a-z]+:\/\//)) {
            if (linkText) {
                start = '\\href{';
                end = '}{' + linkText + '}';
            } else {
                start = '\\url{';
                end = '}';
            }
        } else if (target) {
            // TODO: if target is a package '[' and ']' should be
            // added instead
            start = start + '{';
            end = '}' + end;
        }
        out += start + target + end;
    }
}

/**
    @param {TAFFY} taffyData See <http://taffydb.com/>.
    @param {object} opts
    @param {Tutorial} tutorials
 */
exports.publish = (taffyData, opts, tutorials) => {
    let conf;
    let globalUrl;
    let indexUrl;
    const sourceFilePaths = [];
    let sourceFiles = {};
    let templatePath;

    data = taffyData;

    conf = env.conf.templates || {};
    conf.default = conf.default || {};

    templatePath = path.normalize(opts.template);
    view = new template.Template( path.join(templatePath, 'tmpl') );

    // claim some special filenames in advance, so the All-Powerful Overseer of Filename Uniqueness
    // doesn't try to hand them out later
    indexUrl = helper.getUniqueFilename('index');
    // don't call registerLink() on this one! 'index' is also a valid longname

    globalUrl = helper.getUniqueFilename('global');
    helper.registerLink('global', globalUrl);

    // set up tutorials for helper
    helper.setTutorials(tutorials);

    data = helper.prune(data);
    data.sort('longname, version, since');
    helper.addEventListeners(data);

    fs.mkPath(outdir);
    data().each(doclet => {
        //console.log('DOCLET:', doclet.kind, doclet.name, doclet.longname);
        //console.log('vars, scope:', doclet.vars, doclet.scope);
        for (let i in doclet.params) {
            const p = doclet.params[i];
        }
        for (let i in doclet.properties) {
            const p = doclet.properties[i];
        }
        let rd = '';
        // 'package' and 'typedef' are other possibilities for kind
        if (doclet.kind === 'function' || doclet.kind === 'member') {
            let title = doclet.name;
            let description = doclet.description;
            if (typeof(description) === 'undefined') {
                description = '';
            }
            const paragraphs = description.split(/(?:\n|\r|\r\n){2}/);
            if (1 < paragraphs.length) {
                title = paragraphs.shift();
                description = paragraphs.join('\n\n');
            }
            rd = view.render('rd.tmpl', {
                title: title,
                filename: doclet.meta.filename,
                name: doclet.longname,
                description: description,
                params: typeof(doclet.params) !== 'object'? [] : doclet.params,
                properties: doclet.properties,
            });
            rd = linkifyRd(rd);
        }

        doclet.attribs = '';

        if (doclet.examples) {
            doclet.examples = doclet.examples.map(example => {
                let caption;
                let code;

                if (example.match(/^\s*<caption>([\s\S]+?)<\/caption>(\s*[\n\r])([\s\S]+)$/i)) {
                    caption = RegExp.$1;
                    code = RegExp.$3;
                }

                return {
                    caption: caption || '',
                    code: code || example
                };
            });
            doclet.examples.forEach(e => {
                rd += '\n\\examples{\\dontrun{\n';
                if (e.caption) {
                    rd += e.caption.replace(/^/mg, '# ');
                }
                rd += e.code + '\n}}\n';
            });
        }

        if (rd) {
            const outpath = path.join(outdir, doclet.name + '.Rd');
            fs.writeFileSync(outpath, rd, 'utf8');
        }

        if (doclet.see) {
            doclet.see.forEach((seeItem, i) => {
                doclet.see[i] = hashToLink(doclet, seeItem);
            });
        }

        // build a list of source files
        if (doclet.meta) {
            let sourcePath = getPathFromDoclet(doclet);
            sourceFiles[sourcePath] = {
                resolved: sourcePath,
                shortened: null
            };
            if (!sourceFilePaths.includes(sourcePath)) {
                sourceFilePaths.push(sourcePath);
            }
        }
    });
};
