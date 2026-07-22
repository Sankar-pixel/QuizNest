using Microsoft.AspNetCore.Mvc;
using QuizNest.Api.Services;

namespace QuizNest.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class QuestionGenerationController : ControllerBase
{
    private readonly OllamaService _ollamaService;

    public QuestionGenerationController(OllamaService ollamaService)
    {
        _ollamaService = ollamaService;
    }

    [HttpGet("generate")]
    public async Task<IActionResult> Generate(string subject, int count = 1)
    {
        if (string.IsNullOrWhiteSpace(subject))
            return BadRequest("Subject is required.");

        var text = await _ollamaService.GenerateQuestionAsync(subject, count);
        return Content(text, "application/json");
    }
}
