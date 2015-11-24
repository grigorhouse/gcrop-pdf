/*! Angular-PDF Version: 1.2.4 | Released under an MIT license */
(function() {

  'use strict';

  angular.module('pdf', []).directive('gcropPdf', [ '$http','$document', '$q', '$location', '$rootScope',
   function($http, $document, $q, $location, $rootScope) {

    var renderTask = null;
    var pdfLoaderTask = null;

    var backingScale = function(canvas) {
      var ctx = canvas.getContext('2d');
      var dpr = window.devicePixelRatio || 1;
      var bsr = ctx.webkitBackingStorePixelRatio ||
        ctx.mozBackingStorePixelRatio ||
        ctx.msBackingStorePixelRatio ||
        ctx.oBackingStorePixelRatio ||
        ctx.backingStorePixelRatio || 1;

      return dpr / bsr;
    };

    var startX = 0, startY = 0, x = 0, y = 0, area = null;
    var destHeight = 0;
    var destWidth = 0;
    var rect_height = 0;
    var rects = [];
    var ind = 0;
    var page_heigth, page_width;
    var prev_url;
    var resize_by;
    var back_clicked = false;
    if($rootScope.prev_rects == null){
      $rootScope.prev_rects = [];  
    }
    

    var mouse = {
        x: 0,
        y: 0,
        startX: 0,
        startY: 0
    };

    function setMousePosition(e) {
        var ev = e || window.event; //Moz || IE
        if (ev.pageX) { //Moz
            mouse.x = ev.pageX;
            mouse.y = ev.pageY;
        } else if (ev.clientX) { //IE
            mouse.x = ev.clientX;
            mouse.y = ev.clientY;
        }
    };

    angular.element(document).keyup(function(e){
      if(e.keyCode == 27 || e.keyCode == 46){
        angular.element('.rectangle.active').remove();
        rects.splice(area.id.replace('area',''), 1);
        area = null;
      }
    });

    var setCanvasDimensions = function(canvas, w, h, canvas2) {
      var ratio = backingScale(canvas);
      
      canvas.width = Math.floor(w * ratio);
      $('.canvas-bottom-control').width(canvas.width);
      canvas2.width = Math.floor(w * ratio);
      canvas.height = Math.floor(h * ratio);
      page_heigth = canvas.height;
      canvas.style.width = Math.floor(w * ratio) + 'px';
      canvas2.style.width = Math.floor(w * ratio) + 'px';
      canvas.style.height = Math.floor(h * ratio) + 'px';
      if(ratio != 1){
        canvas.getContext('2d').setTransform(ratio, 0, 0, ratio, 0, 0);  
      }
      
      angular.element('.canvas-of-origin').trigger('resize');

      canvas.parentElement.onmousemove = function (e) {
            setMousePosition();
            if (area !== null) {
                area.style.width = Math.abs(mouse.x - mouse.startX) + 'px';
                area.style.height = Math.abs(mouse.y - mouse.startY) + 'px';
                area.style.left = (mouse.x - mouse.startX < 0) ? mouse.x+1 + 'px' : mouse.startX + 'px';
                area.style.top = (mouse.y - mouse.startY < 0) ? mouse.y+1 + 'px' : mouse.startY + 'px';
            }
        }

      return canvas;
    };
    return {
      restrict: 'E',
      templateUrl: function(element, attr) {
        return attr.templateUrl ? attr.templateUrl : 'partials/viewer.html';
      },
      link: function(scope, element, attrs) {
        if($rootScope.new_file === true){
          $rootScope.new_file = false;
          rects = [];
          $rootScope.prev_rects = [];
          destHeight = 0;
          destWidth = 0;
          rect_height = 0;
          ind = 0;
          page_heigth = 0; 
          page_width = 0;
        }
        var url = scope.pdfUrl;
        var pdfDoc = null;
        var pageNum = (attrs.page ? attrs.page : 1);
        var scale = attrs.scale > 0 ? attrs.scale : 1;
        var canvas2 = document.getElementById('render-canvas');

        var creds = attrs.usecredentials;

        PDFJS.disableWorker = true;
        scope.pageNum = pageNum;

        angular.element('.canvas-of-origin').on('resize', function(e){
          angular.element('.sidebar').height(angular.element(e.target).height());
        });

        scope.renderPage = function(num) {
          if (renderTask) {
              renderTask._internalRenderTask.cancel();
          }

          angular.element('.rectangle').remove();

          angular.element('.canvas-of-origin').append('<canvas id="canvasid'  +num+'">');
          var canvas = document.getElementById('canvasid'+num);

          pdfDoc.getPage(num).then(function(page) {
            var viewport;
            var pageWidthScale;
            var pageHeightScale;
            var renderContext;

            if (attrs.scale === 'page-fit' && !scale) {
              viewport = page.getViewport(1);
              pageWidthScale = element[0].clientWidth / viewport.width;
              pageHeightScale = element[0].clientHeight / viewport.height;
              scale = Math.min(pageWidthScale, pageHeightScale);
            } else {
              viewport = page.getViewport(scale);
            }

            setCanvasDimensions(canvas, viewport.width, viewport.height, canvas2);

            renderContext = {
              canvasContext: canvas.getContext('2d'),
              viewport: viewport
            };

            renderTask = page.render(renderContext);
            renderTask.promise.then(function() {
                if (typeof scope.onPageRender === 'function') {
                    scope.onPageRender();
                }
            }).catch(function (reason) {
                console.log(reason);
            });
          });
        };

        function renderPDF() {
          if (url && url.length) {
            pdfLoaderTask = PDFJS.getDocument({
              'url': url,
              'withCredentials': creds
            }, null, null, scope.onProgress);
            pdfLoaderTask.then(
                function(_pdfDoc) {
                  if (typeof scope.onLoad === 'function') {
                    scope.onLoad();
                  }

                  pdfDoc = _pdfDoc;

                  var i = 1;

                  while(i <= _pdfDoc.numPages){
                    scope.renderPage(i);
                    if($rootScope.prev_rects.length == 0){
                      angular.element('body ').off('click','#canvasid'+i+', .rectangle.active');
                      angular.element('body ').on('click','#canvasid'+i+', .rectangle.active', cropping_func);
                    }else {
                      angular.element('body ').off('click','#canvasid'+i+', .rectangle.active');
                    }
                    i++;
                  }
                }, function(error) {
                  if (error) {
                    if (typeof scope.onError === 'function') {
                      scope.onError(error);
                    }
                  }
                }
            ).then(function(){
              var cropped_area;
              angular.element('.canvas-bottom-control').removeClass('hidden');
              if($rootScope.prev_rects.length == 0)
              angular.forEach(rects, function(value, key){
                cropped_area = document.createElement('div');
                cropped_area.className = 'rectangle';
                cropped_area.id = 'area'+key;
                cropped_area.style.left = value.ins_part.origin_startX + 'px';
                cropped_area.style.top = value.ins_part.origin_startY + 'px';
                cropped_area.style.width = value.ins_part.width + 'px';
                cropped_area.style.height = value.ins_part.height + 'px';
                $('.canvas-of-origin').append(cropped_area);
              });
            });
          }
        }

        var cropping_func = function(event) {
          var canvas = event.target;
          if (area != null) {
            // Getting sizes of cropping area
            var area_height = angular.element('.rectangle.active').first().height();
            var area_width = angular.element('.rectangle.active').first().width();
            if(area_height == 0){
              return;
            }
            var current_ind = area.id.replace('area','');

            page_width = canvas.width;

            rects[current_ind] = {};

            rects[current_ind].canvas_id = event.target.id;
            
            // Gertting cropped part
            var startX = (mouse.x - mouse.startX < 0) ? mouse.x : mouse.startX;
            var startY = (mouse.y - mouse.startY < 0) ? mouse.y : mouse.startY;            

            rects[current_ind].ins_part = {
              startX: startX - angular.element('#'+canvas.id).offset().left,
              startY: startY - angular.element('#'+canvas.id).offset().top,
              origin_startX: startX,
              origin_startY: startY,
              height: area_height,
              width: area_width
            }            
            
            area = null;
            angular.element('.rectangle').removeClass('active');
          } else {
              mouse.startX = mouse.x;
              mouse.startY = mouse.y;
              area = document.createElement('div');
              area.className = 'rectangle active';
              area.id = 'area'+ind;
              area.style.left = mouse.startX + 'px';
              area.style.top = mouse.startY + 'px';
              canvas.parentElement.appendChild(area);
              resize_by = "left_top";
              ind++;
          }
        };

        scope.summorize = function (){
          angular.element('body canvas, .rectangle').off('click');
          addPage().then(function(){            
            angular.forEach(rects,function(value){
              $rootScope.prev_rects.push(value);
            });
            prev_url = scope.pdfUrl;
            scope.savePDF('sdf');
          });
        }

        var cropAll = function(value, ctx2, currentY){
              if(page_heigth - currentY > 0){
                var existImgData = ctx2.getImageData(0, 0, page_width, canvas2.height);

                // Resizing target canvas for size matching
                angular.element('#'+canvas2.id).attr('width', page_width+'px');
                angular.element('#'+canvas2.id).attr('height',rect_height+'px');

                ctx2.fillStyle = "#fff";
                ctx2.fillRect(0, 0, canvas2.width, canvas2.height);
                
                var insertImgData = document.getElementById('canvasid'+parseInt(value.canvas_id.replace('canvasid','') - 1))
                  .getContext('2d').getImageData(
                    value.ins_part.startX,
                    page_heigth - Math.abs(value.ins_part.startY),
                    value.ins_part.width,
                    currentY
                );

                ctx2.putImageData(existImgData, 0, 0, 0, 0, page_width, rect_height);

                ctx2.putImageData(insertImgData, destWidth, destHeight);

                destWidth = 0;
                var existImgData = ctx2.getImageData(0, 0, page_width, canvas2.height);

                var insertImgData = document.getElementById(value.canvas_id)
                  .getContext('2d').getImageData(
                    value.ins_part.startX,
                    0,
                    value.ins_part.width,
                    Math.abs(value.ins_part.height + currentY)
                );

                ctx2.putImageData(existImgData, 0, 0, 0, 0, page_width, rect_height);

                ctx2.putImageData(insertImgData, destWidth, destHeight+page_heigth);

                destWidth += value.ins_part.width;
              } else {
                currentY -= page_heigth;
                cropAll(value, ctx2, currentY);
              }
        }

        var addPage = function(){
          var sinc = $q.defer();

          destHeight = 0;
          destWidth = 0;
          rect_height = 0;
          canvas2 = document.getElementById('render-canvas');
          angular.element('#'+canvas2.id).attr('width', page_width+'px');
          angular.element('#'+canvas2.id).attr('height','1px');

          var ctx2 = canvas2.getContext('2d');
          ctx2.fillStyle="#fff";
          ctx2.fillRect(0, 0, canvas2.width, canvas2.height);

          angular.forEach(rects, function(value, key) {
            // Current canvs height for resulting
            rect_height = canvas2.height;
            console.log(canvas2.height, canvas2.id);

            // Width manipulations for correct sizeing
            if(destWidth + value.ins_part.width >= page_width){
              destWidth = 0;
              destHeight = rect_height;
            }

            // Initalaizing target height
            if(rect_height < value.ins_part.height+destHeight){
              rect_height = value.ins_part.height+destHeight;
            }
            console.log(value);
            if(value.ins_part.startY + value.ins_part.height > page_heigth) {
              var next_height = value.ins_part.startY + value.ins_part.height - page_heigth;
              rect_height -= next_height;
              var existImgData = ctx2.getImageData(0, 0, page_width, canvas2.height);

              // Resizing target canvas for size matching
              angular.element('#'+canvas2.id).attr('width', page_width+'px');
              angular.element('#'+canvas2.id).attr('height',rect_height+'px');

              ctx2.fillStyle = "#fff";
              ctx2.fillRect(0, 0, canvas2.width, canvas2.height);

              var insertImgData = document.getElementById(value.canvas_id).getContext('2d').getImageData(
                  value.ins_part.startX,
                  value.ins_part.startY,
                  value.ins_part.width,
                  page_heigth - value.ins_part.startY
              );

              ctx2.putImageData(existImgData, 0, 0, 0, 0, page_width, rect_height);

              ctx2.putImageData(insertImgData, destWidth, destHeight);

              rect_height += next_height;
              existImgData = ctx2.getImageData(0, 0, page_width, canvas2.height);

              // Resizing target canvas for size matching
              angular.element('#'+canvas2.id).attr('width', page_width+'px');
              angular.element('#'+canvas2.id).attr('height',rect_height+'px');

              ctx2.fillStyle = "#fff";
              ctx2.fillRect(0, 0, canvas2.width, canvas2.height);

              insertImgData = document.getElementById('canvasid'+parseInt(parseInt(value.canvas_id.replace('canvasid','')) + 1)).getContext('2d')
              .getImageData(
                  value.ins_part.startX,
                  1,
                  value.ins_part.width,
                  next_height
              );

              ctx2.putImageData(existImgData, 0, 0, 0, 0, page_width, rect_height);

              ctx2.putImageData(insertImgData, destWidth, destHeight+page_heigth - value.ins_part.startY);
              destHeight += value.ins_part.height;
              destWidth += value.ins_part.width;
            } else if(value.ins_part.startY > 0){
              var existImgData = ctx2.getImageData(0, 0, page_width, canvas2.height);

              // Resizing target canvas for size matching
              angular.element('#'+canvas2.id).attr('width', page_width+'px');
              angular.element('#'+canvas2.id).attr('height',rect_height+'px');

              ctx2.fillStyle = "#fff";
              ctx2.fillRect(0, 0, canvas2.width, canvas2.height);

              var insertImgData = document.getElementById(value.canvas_id).getContext('2d').getImageData(
                  value.ins_part.startX,
                  value.ins_part.startY,
                  value.ins_part.width,
                  value.ins_part.height
              );

              ctx2.putImageData(existImgData, 0, 0, 0, 0, page_width, rect_height);

              ctx2.putImageData(insertImgData, destWidth, destHeight);

              destWidth += value.ins_part.width;
            } else {
              console.log(value.ins_part.startY);
              cropAll(value, ctx2, Math.abs(value.ins_part.startY));
            }

          });

          sinc.resolve('sample');
          return sinc.promise;
        }

        scope.savePDF = function(action){
          if(canvas2.height == 1){
            alert('Nothing highlighted');
            return;
          }
        }

        scope.backToOrigin = function(){
          if($rootScope.back_to_html != true){
            $http.delete('/pdf/0?file='+scope.pdfUrl);
            $rootScope.new_file = false;
            scope.pdfUrl = prev_url;
            $rootScope.prev_rects = [];
          } else {
            $location.path('/new-file');
          }
          
        }

        var resizeArea = function(e){
          this.className = 'rectangle active';
          area = this;
          if(e.pageX - $(e.target).offset().left > e.target.style.width.replace('px','')/2){
            mouse.startX = $(e.target).offset().left;
            mouse.startY  = $(e.target).offset().top;
          } else {
            mouse.startX = parseInt(area.style.left.replace('px', '')) + parseInt(area.style.width.replace('px', ''));
            mouse.startY  = parseInt(area.style.top.replace('px', '')) + parseInt(area.style.height.replace('px', ''));
          }
          var ind = this.id.replace('area','');
        }

        angular.element('body').on('click', '.rectangle:not(active)', resizeArea);     

        scope.$watch('pdfUrl', function(newVal) {
          angular.element('.canvas-of-origin canvas').remove();
          if (newVal !== '') {
            console.log('pdfUrl value change detected: ', scope.pdfUrl);
            url = newVal;
            scope.pageToDisplay = 1;
            if (pdfLoaderTask) {
                pdfLoaderTask.destroy().then(function () {
                    renderPDF();
                });
            } else {
                renderPDF();
            }
          }
        });

      }
    };
  } ]);
})();