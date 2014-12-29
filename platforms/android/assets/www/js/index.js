/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
var app = {
    // Application Constructor
    initialize: function() {
        this.bindEvents();
    },
    // Bind Event Listeners
    //
    // Bind any events that are required on startup. Common events are:
    // 'load', 'deviceready', 'offline', and 'online'.
    bindEvents: function() {
        document.addEventListener('deviceready', this.onDeviceReady, false);
    },
    // deviceready Event Handler
    //
    // The scope of 'this' is the event. In order to call the 'receivedEvent'
    // function, we must explicitly call 'app.receivedEvent(...);'
    onDeviceReady: function() {
        window.dbConnection = window.sqlitePlugin.openDatabase({name: "onyx.db"});
        window.dbConnection.transaction(function(tx) {
            tx.executeSql('CREATE TABLE IF NOT EXISTS saldo_produto (id integer primary key, endereco TEXT, produto TEXT, quant REAL)');
        });
        app.receivedEvent('deviceready');
    },
    // Update DOM on a Received Event
    receivedEvent: function(id) {
        var parentElement = document.getElementById(id);
        var listeningElement = parentElement.querySelector('.listening');
        var receivedElement = parentElement.querySelector('.received');

        listeningElement.setAttribute('style', 'display:none;');
        receivedElement.setAttribute('style', 'display:block;');

        console.log('Received Event: ' + id);
    },
    /**
     * Add loading
     *
     * @author Jair Verçosa
     * @date 27/12/2014
     *
     * @return void
     */
    addLoading : function(){
        var htmlLoading = '<div class="loading"><img src="img/loading.gif" /></div>';
        $('body').append(htmlLoading);
    },
    /**
     * remove loading
     *
     * @author Jair Verçosa
     * @date 27/12/2014
     *
     * @return void
     */
    removeLoading : function(){
        $('body').find('.loading').remove();
    }
};


var onyxlogApp = angular.module('onyxlogApp',['ngRoute']);
onyxlogApp.config(function($routeProvider){
    $routeProvider
        .when('/', {
            templateUrl : 'partials/main.html',
            controller  : 'mainController'
        })
        .when('/saldos_produtos',{
            templateUrl : 'partials/saldo_produtos.html',
            controller  : 'saldosController'
        })
        .when('/enviar_dados',{
            templateUrl : 'partials/enviar_dados.html',
            controller  : 'enviarController'
        });
});

onyxlogApp.controller('mainController', function($scope){
    $scope.onClickLimparBase = function(){
        if(confirm('Deseja realmente limpar a base de dados do coletor?')){
            app.addLoading();
            window.dbConnection.transaction(function(tx) {
                tx.executeSql("delete from saldo_produto;", [], function(tx, res){ 
                    app.removeLoading();
                    alert('Base de dados limpa.');
                });
            }); 
        }
    };
});

onyxlogApp.controller('saldosController', function($scope){
    /*
     * Ativa scanner para endereço
     *
     * @author Jair Verçosa
     * @date 25/12/2014
     *
     * @return void
     */
    $scope.onClickOpenScannerEnd = function(){
        cordova.plugins.barcodeScanner.scan(
            function (result) {
                $('#id_endereco').val(result.text);
            }, 
            function (error) {
                $('.response_form').addClass('alert-danger');
                $('.response_form').html("Falha ao scannear o código de barras: "+ error);
            }
        );
    };

    /*
     * Ativa scanner para produto
     *
     * @author Jair Verçosa
     * @date 25/12/2014
     *
     * @return void
     */
    $scope.onClickOpenScannerProd = function(){
        cordova.plugins.barcodeScanner.scan(
            function (result) {
                $('#id_produto').val(result.text);
            }, 
            function (error) {
                $('.response_form').fadeIn('fast');
                $('.response_form').addClass('alert-danger');
                $('.response_form').html("Falha ao scannear o código de barras: "+ error);
            }
        );
    };

    /*
     * Persiste os dados no banco
     *
     * @author Jair Verçosa
     * @date 25/12/2014
     *
     * @return void
     */
    $scope.onClickGravar = function(){
        var endereco = $('#id_endereco').val();
        var produto  = $('#id_produto').val();
        var quant    = $('#id_quant').val();

        window.dbConnection.transaction(function(tx){
            tx.executeSql("INSERT INTO saldo_produto(endereco, produto, quant) VALUES (?,?,?)", [endereco, produto, quant], function(tx, res){
                alert("Dados gravados");
                $('#id_produto').val('');
                $('#id_quant').val('');
            },function(e) {
                alert("ERROR: " + e.message);
            });
        });
    };

    /*
     * Clique do votão voltar
     *
     * @author Jair Verçosa
     * @date 26/12/2014
     *
     * @return void
     */
    $scope.onClickVoltar = function(){
        history.go(-1);
    };
});

onyxlogApp.controller('enviarController', function($scope, $http){
    /*
     * @var object dados
     */
    $scope.dados = {
        qtdEnd: 0,
        qtdPro: 0
    };

    /**
     * Envia dados do coletor para o servidor
     *
     * @author Jair Verçosa
     * @date 26/12/2014
     * 
     * @return void
     */
    $scope.onClickEnviar = function(){
        if(!confirm("Após enviar os dados, a base do coletor será limpa, deseja continuar?")){
            return;
        }

        if(window.navigator.onLine){

            window.dbConnection.transaction(function(tx) {
                tx.executeSql("select id, endereco, produto, quant from saldo_produto;", [], function(tx, res) {
                    app.addLoading();
                    for (var i = res.rows.length - 1; i >= 0; i--) {
                        $http.post('http://177.55.104.109/estoque/api/saldo/', {
                            "endereco": res.rows.item(i).endereco,
                            "produto" : res.rows.item(i).produto,
                            "quant"   : res.rows.item(i).quant   
                        })
                        .success(function(data){
                            console.log('envio realizado');
                        })
                        .error(function(data, status, headers, config){
                            alert("Falha no envio :: "+ data)
                        });
                    }
                    app.removeLoading();
                    if(confirm("Envio de dados completo, permite limpeza dos dados?")){
                        tx.executeSql("delete from saldo_produto;", [], function(tx, res){ 
                            alert('Base de dados limpa.');
                            window.location.href = "#";
                        });
                    }
                });
            });
        }else{
            alert('Você precisa estar conectado à internet/WiFi.');
        }
    };

    /**
     * Get dos dados para exibição na tela
     *
     * @author Jair Verçosa
     * @date 26/12/2014
     *
     * @return void
     */
    $scope.getData = function(){
        window.dbConnection.transaction(function(tx) {
            tx.executeSql("select endereco from saldo_produto group by endereco;", [], function(tx, res) {
                $scope.dados.qtdEnd = res.rows.length;
                $scope.$apply();
            });

            tx.executeSql("select produto from saldo_produto group by produto;", [], function(tx, res) {
                $scope.dados.qtdPro = res.rows.length;
                $scope.$apply();
            });
        });
    };

    /*
     * Clique do votão voltar
     *
     * @author Jair Verçosa
     * @date 26/12/2014
     *
     * @return void
     */
    $scope.onClickVoltar = function(){
        history.go(-1);
    };

    $scope.getData();
});