using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using QuizNest.Api.Data;
using QuizNest.Api.Models;

namespace QuizNest.Api.Controllers;

[ApiController]
[Route("users")]
public class UsersController : ControllerBase
{
    private readonly QuizNestContext _db;

    public UsersController(QuizNestContext db)
    {
        _db = db;
    }

    [HttpPost]
    public async Task<ActionResult<UserDto>> CreateUser([FromBody] UserCreate payload)
    {
        var username = payload.Username?.Trim();
        if (string.IsNullOrWhiteSpace(username))
            return BadRequest("Username cannot be empty.");

        if (await _db.Users.AnyAsync(u => u.Username == username))
            return BadRequest("Username already taken.");

        var user = new User { Username = username };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetUser), new { username = user.Username }, ToDto(user));
    }

    [HttpGet("{username}")]
    public async Task<ActionResult<UserDto>> GetUser(string username)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == username);
        if (user is null)
            return NotFound();

        return ToDto(user);
    }

    private static UserDto ToDto(User user) => new()
    {
        Id = user.Id,
        Username = user.Username,
        Level = user.Level,
        Xp = user.Xp,
        AvatarConfig = user.AvatarConfig,
        CreatedAt = user.CreatedAt,
    };
}
