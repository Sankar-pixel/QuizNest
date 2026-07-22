using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Mvc;
using QuizNest.Api.Models;

namespace QuizNest.Api.Controllers;

[ApiController]
[Route("quiz")]
public class QuizController : ControllerBase
{
    private static readonly string DataPath = Path.Combine(AppContext.BaseDirectory, "Data", "Questions");

    [HttpGet("{categoryId}")]
    public ActionResult<IEnumerable<QuestionItem>> GetQuestions(string categoryId, int limit = 0)
    {
        var file = Path.Combine(DataPath, $"{categoryId}.json");
        if (!System.IO.File.Exists(file))
        {
            return NotFound(new { detail = $"No questions found for '{categoryId}'" });
        }

        var json = System.IO.File.ReadAllText(file);
        var sourceItems = JsonSerializer.Deserialize<List<QuestionSource>>(json) ?? new List<QuestionSource>();

        var questions = sourceItems.Select(item => new QuestionItem
        {
            Question = item.Question,
            Options = item.Answers,
            Answer = item.CorrectAnswer ?? item.Answers.ElementAtOrDefault(item.CorrectIndex) ?? string.Empty,
            Explanation = item.Explanation,
            Difficulty = item.Difficulty ?? "medium",
        }).ToList();

        if (limit > 0)
        {
            var random = new Random();
            questions = questions.OrderBy(_ => random.Next()).Take(limit).ToList();
        }

        return Ok(questions);
    }

    [HttpGet]
    public ActionResult<IEnumerable<string>> ListCategories()
    {
        if (!Directory.Exists(DataPath))
            return Ok(Array.Empty<string>());

        var categories = Directory
            .EnumerateFiles(DataPath, "*.json")
            .Select(Path.GetFileNameWithoutExtension)
            .ToList();

        return Ok(categories);
    }

    private sealed class QuestionSource
    {
        [JsonPropertyName("question")]
        public required string Question { get; set; }

        [JsonPropertyName("answers")]
        public required string[] Answers { get; set; }

        [JsonPropertyName("correctIndex")]
        public int CorrectIndex { get; set; }

        [JsonPropertyName("correctAnswer")]
        public string? CorrectAnswer { get; set; }

        [JsonPropertyName("explanation")]
        public string? Explanation { get; set; }

        [JsonPropertyName("difficulty")]
        public string? Difficulty { get; set; }
    }
}
