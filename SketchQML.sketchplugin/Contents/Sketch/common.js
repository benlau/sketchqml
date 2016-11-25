
var idTable = {}

function firstCharToLowerCase(string) {
    return string.charAt(0).toLowerCase() + string.slice(1);
}

function firstCharToUpperCase(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/// Generate an ID from text. If it don't contain any valid char, then return undefined
function uniqueId(input) {
    var tmp = input;
    var count = 1;
    while (idTable.hasOwnProperty(tmp)) {
        tmp = input + count;
        count++;
    }
    idTable[tmp] = true;
    return tmp;
}

function genId(text) {
    if (text === undefined) {
        return;
    }

    var res = text.replace(/[^0-9a-zA-Z_]/g, "");

    while (res.length > 0 && res[0].match(/[0-9]/)) {
        res = res.substring(1);
    }

    if (res === "") {
        return;
    }

    res = firstCharToLowerCase(res);
    res = uniqueId(res);

    return res;
}

function genValidClassName(text) {

    var res = text.replace(/[^0-9a-zA-Z_]/g, "");

    while (res.length > 0 && res[0].match(/[0-9]/)) {
        res = res.substring(1);
    }

    if (res === "") {
        return "Untitled";
    }

    res = firstCharToUpperCase(res);

    return res;
}

function formatHex (value) {
    value = Math.round(Number(value)*255);
    var hex = value.toString(16);
    if (hex.length == 1) {
        hex = "0" + hex;
    }
    return hex;
}

function convertToHex(color) {
    var res = "";
    if (color.alpha() < 1.0 ) {
        res = "#" + formatHex(color.alpha()) + formatHex(color.red()) + formatHex(color.green()) + formatHex(color.blue());
    } else {
        res = "#" + formatHex(color.red()) + formatHex(color.green()) + formatHex(color.blue());
    }
    return res;
}


function getColorFromStyle(style) {
    var color = "transparent";

    var fill = style.fill();

    if (fill) {
        color = convertToHex(fill.color());
    }

    return color;
}

function toJson(item) {
    if (item === undefined || item.frame === undefined) {
        return;
    }
    var data = {
        objectName: new String(item.name),
        x: item.frame.x,
        y: item.frame.y,
        width: item.frame.width,
        height: item.frame.height,
        children: []
    }

    var idField = genId(data.objectName);
    if (idField) {
        data["id"] = idField;
    }

    if (item._object.class() == "MSLayerGroup") {
        // ignore

    } else if (item.isText) {
        data.componentType = "Text";
        data.text = item.text;
        var font = item.font;
        data["font.pointSize"] = item._object.fontSize();
        data.color = convertToHex(item._object.textColor());
    } else if (item.isGroup && item._object.hasBackgroundColor()) {
        data.componentType = "Rectangle";
        data.color = convertToHex(item._object.style().fill().color());
    } else if (item._object.class() == "MSShapeGroup") { // Don't use "==="

        // It can't handle the beizer path and sub layer yet. Just treat it as Rectangle

        data.componentType = "Rectangle";
        data.color = getColorFromStyle(item._object.style());

    } else if (item.isImage) {
        data.componentType = "Image";
        data.source = item.name + ".png";
    }

    if (item.isGroup || item.isPage || item.isArtboard) {
        item.iterate(function(child) {
            var childData = toJson(child);
            if (childData !== undefined) {
                data.children.push(childData);
            }
        });
    }

    return data;
}

function leftpad(content, count) {
    var res = "";
    var c = count;
    while (c--) {
        res+= " "
    }
    return res + content;
}

function formatProperty(name, value) {
    if ( (name === "id") ||
         (typeof value !== "object" && typeof value !== "string")
       ) {
        return value;
    }

    return "\"" + value + "\"";
}

function toQML(json, ident) {
    if (ident === undefined) {
        ident = 0;
    }

    var reservedProperties = ["children", "componentType"];

    var componentType = "Item";

    if (json.componentType)  {
        componentType = json.componentType;
    }

    var res = "";

    if (ident === 0) {
        res += "import QtQuick 2.7\n\n"
        json.x = 0;
        json.y = 0;
    }

    res += leftpad(componentType + "{\n", ident);

    for (var i in json) {
        if (reservedProperties.indexOf(i) >=0 ) {
            continue;
            }
        var line = i + ":" + formatProperty(i, json[i]) + "\n";
        res += leftpad(line, ident + 4);
    }

    for (var i in json.children) {
        res += toQML(json.children[i], ident +4);
    }

    res += leftpad("}\n\n", ident);
    return res;
}

function fileName(path) {
    return [[path lastPathComponent] stringByDeletingPathExtension]
}

function exists(path) {
    return NSFileManager.defaultManager().fileExistsAtPath_(path);
}

function dirname(path) {
    return [path  stringByDeletingLastPathComponent];
}

function saveText(file, content) {
    content = NSString.stringWithFormat('%@', content);
    content.writeToFile_atomically_encoding_error_(
        file, true, NSUTF8StringEncoding, null
    );
}

function saveImage(item, folder) {

    var image = item._object.image().image();

    var imageData = [image TIFFRepresentation];
    var imageRep = [NSBitmapImageRep imageRepWithData:imageData];
    var imageProps = [NSDictionary dictionaryWithObject:[NSNumber numberWithFloat:1.0] forKey:NSImageCompressionFactor];
    imageData = [imageRep representationUsingType:NSPNGFileType properties:imageProps];

    imageData.writeToFile(folder + "/" + item.name + ".png");
}

function travel(item, func) {

    if (item === undefined || item.frame === undefined) {
        return;
    }

    func(item);


    if (item.isGroup || item.isPage || item.isArtboard) {
        item.iterate(function(child) {
            travel(child,func);
        });
    }
}

function mkdir(path) {
    NSFileManager.defaultManager().createDirectoryAtPath_withIntermediateDirectories_attributes_error_(
        path, true, nil, nil
    );
}

function createProjectFile(name, file) {
    var content = ["import QmlProject 1.1",
                   "Project {",
                   "mainFile: '" + name + ".qml'",
                   "QmlFiles {",
                   "directory: '.'",
                   "}",
                   "ImageFiles {",
                   "directory: '.'",
                   "}",
                   "}"];

    saveText(file, content.join("\n"));
}

function exportScript(context, iterator) {

    var doc = context.document;
    var sketch = context.api();
    var app = context.api().Application();

    if (!doc.fileURL()) {
        app.alert("Error", "Please save the document first.");
        return;
    }

    var selection = sketch.selectedDocument.selectedLayers;

    if (selection.isEmpty) {
        app.alert("No artboard selected", "Please select the artboard you want to export to QML");
        return;
    }

    var target = dirname(doc.fileURL().path()) + "/QML";

    if (!exists(target)) {
        mkdir(path);
    }

    var error = false;
    try {

        selection.iterate(function(item) {
            var name = new String(item.name);
            name = genValidClassName(name);
            var output = target + "/" + name;

            if (!exists(output)) {
                mkdir(output);
            }

            travel(item, function (child) {
                // export images
                if (child.isImage) {
                    saveImage(child, output);
                }
            });

            iterator(item, output);
        });
    } catch (e) {
        app.alert("Exception Error", e);
        error = true;
    }

    if (!error) {
        app.alert("QML file(s) are exported completed. Please check the \"QML\" folder in the document path.", "Finished");
    }


}