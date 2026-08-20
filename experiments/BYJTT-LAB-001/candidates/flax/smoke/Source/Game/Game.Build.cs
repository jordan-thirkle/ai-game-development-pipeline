using Flax.Build;

public class Game : GameModule
{
    public override void Init()
    {
        base.Init();
        BuildNativeCode = false;
    }

    public override void Setup(BuildOptions options)
    {
        base.Setup(options);
        options.ScriptingAPI.IgnoreMissingDocumentationWarnings = true;
    }
}
