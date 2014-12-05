(function(define) {define(function(require){

    return {
    
        bus:null,
        config:{
            id:null,
            type:'tcp'
        },
        
        init:function(){
            var methods={};
            methods['ports.'+this.config.id+'.start']=this.start;
            methods['ports.'+this.config.id+'.stop']=this.stop;
            this.bus.register(methods);
        },
        
        start:function(callback){
            
        },
        
        stop:function(callback){
            
        }
    }
});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));
