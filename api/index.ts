require('dotenv').config();

const express = require('express');
const axios = require('axios');
const path = require('path');
const { TwitterApi } = require('twitter-api-v2');

const app = express();
app.use(express.static('public'));
const port = process.env.PORT || 8000;

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_APP_KEY,
  appSecret: process.env.TWITTER_APP_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '..', 'components', 'home.htm'));
});

app.get('/techNews', async (req, res) => {
  try {
    const response = await axios.get(`https://newsapi.org/v2/everything`, {
      params: {
        q: 'CryptoCurrency',
        language: 'en',
        sortBy: 'publishedAt',
        apiKey: process.env.NEWS_API_KEY,
      },
    });

    const articles = response.data.articles;

    if (articles.length) {
      const firstArticle = articles[0]; // Get the first article only
      const rephrasedContent = await rephraseWithGoogleBard(
        firstArticle.title,
        firstArticle.url,
        firstArticle.description
      );

      // Log the rephrased content to check if it's being fetched correctly
      console.log('Rephrased content:', rephrasedContent);

      // Posting to Twitter
      await postToTwitter(rephrasedContent); // Post rephrased content to Twitter

      const newsArticle = {
        title: firstArticle.title,
        description: firstArticle.description,
        content: firstArticle.content,
        urlToImage: firstArticle.urlToImage,
        url: firstArticle.url,
        publishedAt: new Date(firstArticle.publishedAt).toLocaleString(),
        rephrasedContent: rephrasedContent,
        fetchedAt: new Date().toLocaleString(), // Time when the API was called
      };

      // Log the entire newsArticle to check all data
    //   console.log('News Article:', newsArticle);

      res.status(200).json({ article: newsArticle }); // Send the article with all the required info
    } else {
      res.status(404).send({ message: 'No news articles found' });
    }
  } catch (error) {
    console.error('Error fetching news:', error.message);
    res.status(500).json({ message: 'Error fetching news' });
  }
});

// Function to rephrase content using Google Bard API
async function rephraseWithGoogleBard(title, url, description) {
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.BARD_API_KEY}`,
      {
        contents: [
          {
            parts: [
              {
                text: `Generate a concise and engaging tweet for X.com under 279 characters based on the news title: ${title}. 
                Use the reference URL: ${url} to gather more information. 
                Include relevant hashtags, emojis, and avoid posting any reference links in the tweet. 
                Ensure that the tone is aligned with the topic of cryptocurrency. 
                Here’s a brief summary to help: ${description}.`,
              },
            ],
          },
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const rephrasedText =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    // Log rephrased text to check if it's being returned correctly
    // console.log(rephrasedText, 'rephrasedText');

    return rephrasedText || `${title} - ${url}`; // Return the rephrased text, or fallback to the original title and URL
  } catch (error) {
    console.error('Error rephrasing content:', error.message);
    return `${title} - ${url}`; // In case of error, return the original title and URL
  }
}

// Function to post the tweet to Twitter
async function postToTwitter(tweetText) {
  try {
    const { data } = await twitterClient.v2.tweet(tweetText);
    console.log(`Tweet posted successfully with ID: ${data.id}`);
    latestTweet = tweetText; // Update the latestTweet variable
  } catch (error) {
    console.error("Error posting to Twitter:", error.message);
  }
}

app.listen(port, () => console.log(`Server ready on port ${port}.`));

module.exports = app;
