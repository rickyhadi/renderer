var readFile = require('readfile');
var Handlebars = require('handlebars');

function sprintf(src, data) {
	Object.keys(data).forEach(function(key){
		var r = new RegExp('{'+key+'}', 'g');
		src = src.replace(r, data[key]);
	});
	return src;
}; 

async function classGetter(classname, args, templatefile, dict){
    var result = '';
    var data = dict[classname](args);
    if(templatefile){
        var source = await readFile(templatefile);
        var template = Handlebars.compile(source);
        result = template(data);
    }
    else{
        result = data;
    }
    
    return result;
};

function renderer(getCoreConfig, staticConfig, dictClassGetter){
	
    var obj={};
    obj.renderPage = async function renderPage(section, req, data) {
        
        var result = '';
        try{
            if(staticConfig[section]){
                var coreConfig = await getCoreConfig(section, req);
                if(data){
                    coreConfig = Object.assign({}, coreConfig, data);
                }
                result += await obj.renderContent(staticConfig[section].Childs, coreConfig);
                if (staticConfig[section].ReplaceResult)
                {
                    result = await obj.renderReplace(result, staticConfig[section].ReplaceResult, coreConfig);
                }
            }
        }
        catch(ex)
        {
            console.log('renderer.renderPage ' + section + ' ' + ex);
        }
        return result;
    };
    obj.renderContent = async function renderContent(sectionConfig, coreConfig) {
        var result = '';
        try{
            if(Array.isArray(sectionConfig)){
                var arraylength = sectionConfig.length;
                for(var i=0; i<arraylength; i++){
                    result += await obj.renderContent(sectionConfig[i], coreConfig);
                }
            }
            else{
                var canRender = true;
                if(sectionConfig.Condition){
                    try{
                        var conditionobj = sectionConfig.Condition;
                        canRender = classGetter(conditionobj.ClassName, conditionobj.ParamArgs, null, dictClassGetter);
                    }
                    catch(ex)
                    {
                        console.log('renderer.renderContent.Condition ' + ex);
                    }
                }
                if(canRender){
                    var config_category = sectionConfig.Category;
                    switch(config_category){
                        case 'TAG':
                            var config_tag = sectionConfig.Tag;
                            if(config_tag){
                                result += '<' + config_tag;
                                if (sectionConfig.Attributes)
                                {
                                    var attribute = sectionConfig.Attributes;
                                    Object.keys(attribute).forEach(function(key){
                                        if(attribute[key]){
                                            result += ' ' + key + '="' + sprintf(attribute[key], coreConfig) + '"';
                                        }
                                    });
                                }
                                result += '>';
                                if (sectionConfig.Childs)
                                {
                                    result += await obj.renderContent(sectionConfig.Childs, coreConfig);
                                }
                                result += '</' + config_tag + '>';
                            }
                            break;
                        case 'TEMPLATE':
                            var config_key = sectionConfig.Key;
                            result += await obj.renderContent(staticConfig.TEMPLATE[config_key], coreConfig);
                            break;
                        case 'FILE':
                            var config_file = sectionConfig.File;
                            var cookedSource = sprintf(config_file, coreConfig);
                            var content = await readFile(cookedSource);
                            result += sprintf(content, coreConfig);
                            break;
                        case 'BLANK':
                            if (sectionConfig['Childs'])
                            {
                                result += await obj.renderContent(sectionConfig.Childs, coreConfig);
                            }
                            break;
                        case 'CODEBEHIND':
                            var config_class = sectionConfig.Class;
                            var templatefile =  sprintf(config_class.TemplateFile, coreConfig);
                            result += await classGetter(config_class.ClassName, config_class.ParamArgs, templatefile, dictClassGetter);
                            break;
                    }
                }
            }
        }
        catch(ex){
            console.log('renderer.renderContent ' + ex);
        }
        return result;
    };
    obj.renderReplace = async function renderReplace(result, replaceConfig, coreConfig) {
        try{
            if(Array.isArray(replaceConfig)){
                var arraylength = replaceConfig.length;
                for(var i=0; i<arraylength; i++){
                    result = await obj.renderReplace(result, replaceConfig[i], coreConfig);
                }
            }
            else{
                var placeholder = replaceConfig.Placeholder;
                var replace_result = await obj.renderContent(replaceConfig.Replace, coreConfig);
                var data = {};
                data[placeholder] = replace_result;
                result = helper.sprintf(result, data);
            }
        }
        catch(ex){
            console.log('renderer.renderReplace ' + ex);
        }
        return result;
    };
    return obj;
}

module.exports = renderer;
