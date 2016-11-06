// get token from readability by registering at their site
var readabilityToken = "";

function getBoilerPipeText(url, successCallback, errorCallback) {
  var bolierPipeUri = "http://boilerpipe-web.appspot.com/extract?output=text&url=" + url;
  var bolierPipeAjax = new XMLHttpRequest();
  bolierPipeAjax.onload = function() {
    if (bolierPipeAjax.status == 200) {
      console.log("bolierpipe text: " +  bolierPipeAjax.responseText);
      successCallback(bolierPipeAjax.responseText);
    } else {
      errorCallback(bolierPipeAjax.status);
    }
  }
  bolierPipeAjax.onerror = errorCallback;
  bolierPipeAjax.open('GET', bolierPipeUri, true);
  bolierPipeAjax.send();
}
// get plain article text from readability
function getCleanText(url, successCallback, errorCallback) {
  var readabilityUri =
      "https://readability.com/api/content/v1/parser?token=" + readabilityToken + "&url=" + url;
  var readabilityAjax = new XMLHttpRequest();

  readabilityAjax.onload = function() {
      if (readabilityAjax.status == 200) {
        // parse as per readability api spec
        var response = JSON.parse(readabilityAjax.responseText);
        if (response.error != 'undefined') {
          var dummyElement = document.createElement("div");
          dummyElement.innerHTML = response.content;
          console.log("readability text;" + dummyElement.innerText);
          successCallback(dummyElement.innerText);
        } else {
          errorCallback(response.message);
        }
    } else {
      errorCallback("Failed to get text from readability");
    }
  };
  readabilityAjax.onerror = errorCallback;
  readabilityAjax.open("GET", readabilityUri, true);
  readabilityAjax.send(null);
}

/**
 * Get the current URL.
 *
 * @param {function(string)} callback - called when the URL of the current tab
 *   is found.
 */
function getCurrentTabUrl(callback) {

  var queryInfo = {
    active: true,
    currentWindow: true
  };

  chrome.tabs.query(queryInfo, function(tabs) {
    var tab = tabs[0];
    var url = tab.url;
    console.assert(typeof url == 'string', 'tab.url should be a string');
    callback(url);
  });
}

// get google trending search terms in india
function getTrendingKeywords(successCallback, errorCallback) {
  var trendUrl = 'http://hawttrends.appspot.com/api/terms/';
  var ajax = new XMLHttpRequest();
  ajax.open('GET', trendUrl);
  ajax.responseType = 'json';
  ajax.onload = function() {
    var response = ajax.response;
    if (!response || response.length === 0) {
      errorCallback("Error in trend server");
      return;
    }
    var jsonData = response;
    if (!jsonData) {
      errorCallback("JSON Data error: " + JSON.parse(jsonData));
    } else {
      successCallback(jsonData["3"]); // 3 is for india
    }
  };
  ajax.onerror = function() {
    errorCallback('Network error.' + ajax.statusText);
  };
  ajax.send();
}

function renderStatus(statusText) {
  document.getElementById('status').textContent = statusText;
}
function renderResult(resultTxt) {
  document.getElementById('result').textContent += resultTxt;
}
// returns npov bias score
function getNpovBiasScore(text) {
  sentences = text.split(/\.|\?/); //crude sentence extractor split on . or ?
  totalSentences = sentences.length;
  totalBiasSentences = 0;
  totalBiasWords = 0;
  totalWords = 0;
  for(i = 0; i < totalSentences; i++) {
    words = sentences[i].split(/,| /); // split on comma and space
    totalWords += words.length;
    var biasFound = false;
    for(j = 0; j < words.length; j++) {
      word = words[j];
      if (npovBiasLexicon.indexOf(word.toLowerCase()) > -1) {
        biasFound = true;
        totalBiasWords++;
      }
    }
    if (biasFound) {
      totalBiasSentences++;
    }
  }
  var result = {};
  result.totalSentences = totalSentences;
  result.totalBiasSentences = totalBiasSentences;
  result.totalBiasWords = totalBiasWords;
  result.totalWords = totalWords;
  return result;
}
// split text into sentences after converting to lower case
function tokenizeText(text) {
  sentences = text.toLowerCase().split(/\.|\?|\“|\"|\”/); //crude sentence extractor split on . or ?
  return sentences;
}
// start
document.addEventListener('DOMContentLoaded', function() {
    renderStatus("Processing...");
    var sentences;
    var trendingTopics;
    var liuHuPending = true;
    var npovScore;
    var liuHuScore;
    var DEBUG = false;
    // display result on popup page
    var showResults = function () {
      document.getElementById("loading").style.display = 'none';
      var npov = npovScore.totalBiasSentences/npovScore.totalSentences;
      if (DEBUG) {
        document.getElementById("result").innerHTML += "Bias Score: " + npov;
      } else {
        document.getElementById("result").innerHTML = "Bias Score: " + npov;
      }
      var maxScore = maxLiuHuScore(liuHuScore);
      var separator = 1;
      if (2*maxScore.total - (maxScore.positive + maxScore.negative) != 0)
        separator = (maxScore.total -  maxScore.negative)/(2*maxScore.total - (maxScore.positive + maxScore.negative));
      console.log("Separator" + separator);
      if (separator != 1 && separator > 0.5)
        separator = 1.2*separator;
      else if (separator < 0.5)
        separator = 0.8*separator;

      //var c = document.createElement('canvas');
      //c.width = document.getElementById('canvas-container').clientWidth;
      //c.height = document.getElementById('canvas-container').clientHeight;
      //document.getElementById('canvas-container').append(c);
      document.getElementById('canvas-container').style.display = 'block';
      var c = document.getElementById("result-bar-right");
      var ctx = c.getContext("2d");
      ctx.canvas.width  = 200;//window.innerWidth;
      ctx.canvas.height = 70;//window.innerHeight;
      var grd = ctx.createLinearGradient(0, 0, 250, 0);
      grd.addColorStop(0, "green");
      grd.addColorStop(separator, "yellow");
      grd.addColorStop(1, "red");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, 250, 50);
    }

    // max of liu hu score
    var maxLiuHuScore = function() {
      max = {};
      for (var i = 0; i < liuHuScore.length; i++) {
        var result = liuHuScore[i];
        if(result.total > 0 && (!max.total || max.total < result.total)) {
          max = result;
        }
      }
      return max;
    }
    // not used without topic sentences
    var getLiuHuOpinionNoTopic = function (sentences) {
      totalSentences = sentences.length;
      entityCount = 0;
      posCount = 0;
      negCount = 0;
      for(var i = 0; i < totalSentences; i++) {
        words = sentences[i].split(/,| /);
        negFound = false;
        posFound = false;
        for(var j = 0; j < words.length; j++) {
          word = words[j];
          if(liuHuNegWords.indexOf(word) > -1)
              negFound = true;
          if(liuHuPosWords.indexOf(word) > -1)
              posFound = true;

        } //iterate through words of the sentence
        if(posFound)
            posCount++;
        if(negFound)
            negCount++;
      }
      return {"positive": posCount,
          "negative": negCount};
    }
    // get liu hu sentiment score for given trending topic
    var getLiuHuOpinion = function(sentences, trendingTopic) {
      totalSentences = sentences.length;
      entityCount = 0;
      posCount = 0;
      negCount = 0;
      console.log(trendingTopic);
      var trendingWords = trendingTopic.toLowerCase().split(' ');
      console.log(trendingWords);
      for(var i = 0; i < totalSentences; i++) {
        for (var k = 0; k < trendingWords.length; k++) {
          var trendingEntity = trendingWords[k];

          if (stopwords.indexOf(trendingEntity) > -1 || trendingEntity.length < 2)
            continue;

          words = sentences[i].split(/,| /);
          //if(sentences[i].indexOf(trendingEntity) > -1) {
          if(words.indexOf(trendingEntity) > -1) {
            entityCount++;
            negFound = false;
            posFound = false;
            for(var j = 0; j < words.length; j++) {
              word = words[j];
              if(liuHuNegWords.indexOf(word) > -1)
                  negFound = true;
              if(liuHuPosWords.indexOf(word) > -1)
                  posFound = true;

            } //iterate through words of the sentence
            if(posFound)
                posCount++;
            if(negFound)
                negCount++;
          }
        }
      }
      return {"topic": trendingTopic,
          "positive": posCount,
          "negative": negCount,
          "total": entityCount};
    }
    // wrapper to all liu hu processing
    var processLiuHu = function() {
      if (liuHuPending === false)
        return;
      result = [];
      console.log(JSON.stringify(trendingTopics));
      console.log("# of trending topics " + trendingTopics.length);
      for (var i = 0; i < trendingTopics.length; i++) {
        var temp = getLiuHuOpinion(sentences, trendingTopics[i]);
        result.push(temp);
      }
      return result;
    }
    // word with term frequency
    var maxTermFreq = function () {
      var words = [];
      for (var i = 0; i < sentences.length; i++) {
        var tempWords = sentences[i].split(/,| /);
        //var tempWords = sentences[i].split(/['";:,.\/?\\-]/);
        for (var j = 0; j < tempWords.length; j++) {
          tempWords[j] = tempWords[j].trim();
          tempWords[j] = tempWords[j].replace(/['";:,.\/?\\-]/g,'');
          if (tempWords[j].length > 1)
            words.push(tempWords[j]);
        }
      //  words = words.concat(); // split on comma and space
      }
      //console.log("words: " + JSON.stringify(words));
      var termFreq = {};
      var maxCount = 1;
      var maxWord = words[0];
      for (var i = 0; i < words.length; i++) {
        var term = words[i];
        if (stopwords.indexOf(term) > -1)
          continue;
        if (termFreq[term] == null) {
          termFreq[term] = 1;
        } else {
          termFreq[term]++;
        }
        if (termFreq[term] > maxCount) {
          maxCount = termFreq[term];
          maxWord = term;
        }
      }
      console.log(maxWord + " #" + maxCount);
      return maxWord; //{"term": maxWord, "count": maxCount};
    }

    function processText(text) {
      renderStatus('Analyzing the text...');
      sentences = tokenizeText(text);
      npovScore = getNpovBiasScore(text);
      trendingTopics = [];
      trendingTopics.push(maxTermFreq());
      if (liuHuPending === true && trendingTopics != null && trendingTopics.length != null && trendingTopics.length > 0) {
        liuHuScore = processLiuHu();
        liuHuPending = false;
      }
      renderResult("NPOV Score: " + JSON.stringify(npovScore));
      renderResult("LiuHu No topic score: " + JSON.stringify(getLiuHuOpinionNoTopic(sentences)));

      renderResult("LiuHu Score: " + JSON.stringify(maxLiuHuScore(liuHuScore)));
      showResults();
      renderStatus("");
    }
    getCurrentTabUrl(function(url) {
    //renderStatus('Cleaning the document...');

    getCleanText(url, processText, function(msg){
      getBoilerPipeText(url, processText, function(errorMessage){
          renderStatus(msg);
        });
    });
    // disabled trending topic completely
    /*
    getTrendingKeywords(function(data) {
      trendingTopics = data;
      if (liuHuPending === true && sentences != null && sentences.length != null && sentences.length > 0) {
        liuHuScore = processLiuHu();
        liuHuPending = false;
        renderStatus("LiuHu Score: " + JSON.stringify(maxLiuHuScore(liuHuScore)));
      }
    }, function(msg){
      console.error(msg);//renderStatus(msg);
    });*/
    return;
  });
});
