'use strict';

/**
 * @ngdoc function
 * @name angularApp.controller:DocCtrl
 * @description
 * # DocCtrl for viewing and rendering pdfs
 * Controller of the angularApp
 */
angular.module('angularApp')
	.controller('PDFRend', ['$scope', function($scope) {
		$scope.pdfUrl = 'pdfs/sample.pdf';
	}]);