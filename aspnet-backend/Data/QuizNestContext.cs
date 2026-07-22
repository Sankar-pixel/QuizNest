using Microsoft.EntityFrameworkCore;
using QuizNest.Api.Models;

namespace QuizNest.Api.Data;

public class QuizNestContext : DbContext
{
    public QuizNestContext(DbContextOptions<QuizNestContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<LeaderboardEntry> LeaderboardEntries => Set<LeaderboardEntry>();
}
