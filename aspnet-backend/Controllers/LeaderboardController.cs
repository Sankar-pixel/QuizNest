using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuizNest.Api.Data;
using QuizNest.Api.Models;

namespace QuizNest.Api.Controllers;

[ApiController]
[Route("leaderboard")]
public class LeaderboardController : ControllerBase
{
    private readonly QuizNestContext _db;

    public LeaderboardController(QuizNestContext db)
    {
        _db = db;
    }

    [HttpPost]
    public async Task<ActionResult<object>> SubmitScore([FromBody] ScoreSubmission payload)
    {
        var username = payload.Username?.Trim();
        if (string.IsNullOrWhiteSpace(username))
            return BadRequest("Username cannot be empty.");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == username);
        if (user is null)
        {
            user = new User { Username = username };
            _db.Users.Add(user);
            await _db.SaveChangesAsync();
        }

        user.Xp += payload.XpEarned;
        user.Level = CalculateLevel(user.Xp);
        _db.Users.Update(user);

        var entry = new LeaderboardEntry
        {
            Username = username,
            CategoryId = payload.CategoryId,
            XpEarned = payload.XpEarned,
        };

        _db.LeaderboardEntries.Add(entry);
        await _db.SaveChangesAsync();

        return new
        {
            status = "recorded",
            username = username,
            userXp = user.Xp,
            level = user.Level,
        };
    }

    [HttpGet("top")]
    public async Task<ActionResult<IEnumerable<object>>> GetTopPlayers(int limit = 10)
    {
        var results = await _db.LeaderboardEntries
            .GroupBy(entry => entry.Username)
            .Select(group => new
            {
                Username = group.Key,
                TotalXp = group.Sum(e => e.XpEarned)
            })
            .OrderByDescending(x => x.TotalXp)
            .Take(limit)
            .ToListAsync();

        return Ok(results);
    }

    [HttpGet("search")]
    public async Task<ActionResult<IEnumerable<object>>> SearchPlayers(string username, int limit = 10)
    {
        if (string.IsNullOrWhiteSpace(username))
            return Ok(Array.Empty<object>());

        var queryValue = username.Trim().ToLowerInvariant();
        var results = await _db.LeaderboardEntries
            .Where(entry => entry.Username.ToLower().Contains(queryValue))
            .GroupBy(entry => entry.Username)
            .Select(group => new
            {
                Username = group.Key,
                TotalXp = group.Sum(e => e.XpEarned)
            })
            .OrderByDescending(x => x.TotalXp)
            .Take(limit)
            .ToListAsync();

        return Ok(results);
    }

    private static int CalculateLevel(int totalXp) => 1 + totalXp / 100;
}
